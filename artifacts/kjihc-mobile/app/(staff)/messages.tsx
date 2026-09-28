/**
 * Staff Messages tab — channel list, conversation modal, thread modal.
 * Supports: Notice Boards, Direct Messages, Group Chats.
 * Image attachments via expo-image with Bearer auth headers.
 * Real-time updates via 8-second polling (EventSource not available in RN).
 */
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Pressable, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useListChannels,
  useListMessages,
  useCreateMessage,
  useCreateChannel,
  useGetThread,
  useCreateReply,
  useToggleReaction,
  useRequestUploadUrl,
  messagesQueryKey,
  channelsQueryKey,
  type Channel,
  type ChatMessage,
  type Attachment,
} from '../../../../lib/api-client-react/src/messaging';
import { getBaseUrl } from '../../../../lib/api-client-react/src/custom-fetch';
import { useListMembers, type Member } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const POLL_INTERVAL_MS = 8_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateSep(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupChannels(channels: Channel[]) {
  return {
    noticeboard: channels.filter(c => c.type === 'noticeboard'),
    direct: channels.filter(c => c.type === 'direct'),
    group: channels.filter(c => c.type === 'group'),
  };
}

function flattenMessages(data: ReturnType<typeof useListMessages>['data']): ChatMessage[] {
  return data?.pages.flatMap(p => p) ?? [];
}

function needsDateSep(msgs: ChatMessage[], index: number): boolean {
  // msgs is newest-first; in the inverted list, index 0 is at the bottom.
  // We show a separator above a message when the next message in visual
  // order (i.e. msgs[index+1]) is on a different day.
  if (index === msgs.length - 1) return true; // topmost visible message
  const curr = new Date(msgs[index].createdAt).toDateString();
  const older = new Date(msgs[index + 1].createdAt).toDateString();
  return curr !== older;
}

// ── Storage image with auth ────────────────────────────────────────────────────

function StorageImage({
  objectPath, style, onPress,
}: {
  objectPath: string;
  style?: object;
  onPress?: () => void;
}) {
  const { getToken } = useAuth();
  const [headers, setHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    getToken().then(t => {
      if (t) setHeaders({ Authorization: `Bearer ${t}` });
    });
  }, [getToken]);

  const base = getBaseUrl() ?? '';
  const uri = `${base}/api/storage/objects/${objectPath.replace(/^\/+/, '')}`;

  const content = (
    <Image
      source={{ uri, headers }}
      style={[{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10 }, style]}
      contentFit="cover"
      transition={200}
    />
  );

  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>;
}

// ── Full-screen image lightbox ─────────────────────────────────────────────────

function LightboxModal({ objectPath, onClose }: { objectPath: string; onClose: () => void }) {
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={lb.backdrop}>
        <TouchableOpacity style={lb.closeBtn} onPress={onClose}>
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>
        <StorageImage objectPath={objectPath} style={{ width: '100%', height: '80%', borderRadius: 0 }} />
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
});

// ── Reaction picker sheet ──────────────────────────────────────────────────────

function ReactionSheet({
  visible, onReact, onReply, onClose,
}: {
  visible: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={rs.backdrop} onPress={onClose}>
        <Pressable style={[rs.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Emoji row */}
          <View style={rs.emojiRow}>
            {QUICK_REACTIONS.map(e => (
              <TouchableOpacity
                key={e}
                style={rs.emojiBtn}
                onPress={() => { Haptics.selectionAsync(); onReact(e); onClose(); }}
              >
                <Text style={rs.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Reply in thread */}
          <TouchableOpacity
            style={[rs.replyRow, { borderTopColor: colors.border }]}
            onPress={() => { onReply(); onClose(); }}
          >
            <Ionicons name="return-down-back" size={18} color={colors.foreground} />
            <Text style={[rs.replyText, { color: colors.foreground }]}>Reply in thread</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const rs = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { marginHorizontal: 16, marginBottom: 32, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8 },
  emojiBtn: { padding: 8 },
  emoji: { fontSize: 28 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1 },
  replyText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

// ── Message bubble ─────────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ChatMessage;
  isMe: boolean;
  showSender: boolean;
  senderLabel: string;
  onLongPress: (msg: ChatMessage) => void;
  onAttachmentPress: (objectPath: string) => void;
  onReplyCountPress: (msg: ChatMessage) => void;
}

function MessageBubble({
  msg, isMe, showSender, senderLabel,
  onLongPress, onAttachmentPress, onReplyCountPress,
}: BubbleProps) {
  const colors = useColors();
  const isDeleted = msg.deletedAt !== null;
  const hasReactions = Object.keys(msg.reactions ?? {}).length > 0;

  return (
    <View style={[bub.row, isMe && bub.rowMe]}>
      <View style={[bub.wrap, isMe && bub.wrapMe, { maxWidth: '82%' }]}>
        {/* Sender label for non-self messages */}
        {showSender && !isMe && (
          <Text style={[bub.sender, { color: colors.secondary }]}>{senderLabel}</Text>
        )}

        {/* Bubble */}
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => { if (!isDeleted) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLongPress(msg); } }}
          delayLongPress={300}
        >
          <View style={[
            bub.bubble,
            isMe
              ? { backgroundColor: '#001f3d', borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          ]}>
            {isDeleted ? (
              <Text style={[bub.deletedText, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.mutedForeground }]}>
                Message deleted
              </Text>
            ) : (
              <>
                {msg.content ? (
                  <Text style={[bub.text, { color: isMe ? '#fff' : colors.foreground }]}>
                    {msg.content}
                  </Text>
                ) : null}

                {(msg.attachments ?? []).map((att: Attachment) => (
                  <View key={att.id} style={{ marginTop: msg.content ? 8 : 0 }}>
                    {att.mimeType.startsWith('image/') ? (
                      <StorageImage
                        objectPath={att.objectPath}
                        onPress={() => onAttachmentPress(att.objectPath)}
                        style={{ borderRadius: 8 }}
                      />
                    ) : (
                      <View style={[bub.filePill, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : colors.muted }]}>
                        <Ionicons name="document-outline" size={16} color={isMe ? '#fff' : colors.foreground} />
                        <Text style={[bub.fileName, { color: isMe ? '#fff' : colors.foreground }]} numberOfLines={1}>
                          {att.fileName}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Timestamp */}
        <Text style={[bub.time, { color: colors.mutedForeground }, isMe && { alignSelf: 'flex-end' }]}>
          {fmtTime(msg.createdAt)}
        </Text>

        {/* Reactions */}
        {hasReactions && (
          <View style={[bub.reactions, isMe && bub.reactionsMe]}>
            {Object.entries(msg.reactions).map(([emoji, count]) => (
              <View key={emoji} style={[bub.reactionPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={bub.reactionEmoji}>{emoji}</Text>
                <Text style={[bub.reactionCount, { color: colors.foreground }]}>{count as number}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reply count */}
        {(msg.replyCount ?? 0) > 0 && (
          <TouchableOpacity
            style={[bub.replyCount, isMe && bub.replyCountMe]}
            onPress={() => onReplyCountPress(msg)}
          >
            <Ionicons name="return-down-back" size={12} color="#2563eb" />
            <Text style={bub.replyCountText}>
              {msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const bub = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 3 },
  rowMe: { justifyContent: 'flex-end' },
  wrap: { alignItems: 'flex-start' },
  wrapMe: { alignItems: 'flex-end' },
  sender: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 3, marginLeft: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  text: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  deletedText: { fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic' },
  time: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3, marginLeft: 2 },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 8 },
  fileName: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginLeft: 2 },
  reactionsMe: { justifyContent: 'flex-end', marginLeft: 0, marginRight: 2 },
  reactionPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  replyCount: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginLeft: 2 },
  replyCountMe: { marginLeft: 0, marginRight: 2 },
  replyCountText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#2563eb' },
});

// ── Noticeboard wall post card ─────────────────────────────────────────────────

function initialsOf(name: string) {
  return name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function fmtWallDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }) + ` at ${time}`;
}

function NoticeCard({
  msg, senderLabel, onLongPress, onAttachmentPress, onReplyCountPress, onReact,
}: {
  msg: ChatMessage;
  senderLabel: string;
  onLongPress: (msg: ChatMessage) => void;
  onAttachmentPress: (objectPath: string) => void;
  onReplyCountPress: (msg: ChatMessage) => void;
  onReact: (msg: ChatMessage, emoji: string) => void;
}) {
  const colors = useColors();
  const isDeleted = msg.deletedAt !== null;
  const reactions = Object.entries(msg.reactions ?? {});
  const imageAtts = (msg.attachments ?? []).filter((a: Attachment) => a.mimeType.startsWith('image/'));
  const fileAtts = (msg.attachments ?? []).filter((a: Attachment) => !a.mimeType.startsWith('image/'));

  return (
    <Pressable
      onLongPress={() => { if (!isDeleted) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLongPress(msg); } }}
      delayLongPress={300}
      style={[wall.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Author row */}
      <View style={wall.authorRow}>
        <View style={wall.avatar}>
          <Text style={wall.avatarText}>{initialsOf(senderLabel)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wall.authorName, { color: colors.foreground }]}>{senderLabel}</Text>
          <Text style={[wall.postDate, { color: colors.mutedForeground }]}>{fmtWallDate(msg.createdAt)}</Text>
        </View>
        <Ionicons name="megaphone" size={16} color="#f6a800" />
      </View>

      {/* Body */}
      {isDeleted ? (
        <Text style={[wall.deleted, { color: colors.mutedForeground }]}>This notice was removed</Text>
      ) : (
        <>
          {msg.content ? (
            <Text style={[wall.body, { color: colors.foreground }]}>{msg.content}</Text>
          ) : null}
          {imageAtts.map((att: Attachment) => (
            <View key={att.id} style={wall.imageWrap}>
              <StorageImage objectPath={att.objectPath} onPress={() => onAttachmentPress(att.objectPath)} style={{ borderRadius: 10 }} />
            </View>
          ))}
          {fileAtts.map((att: Attachment) => (
            <View key={att.id} style={[wall.filePill, { backgroundColor: colors.muted }]}>
              <Ionicons name="document-outline" size={16} color={colors.foreground} />
              <Text style={[wall.fileName, { color: colors.foreground }]} numberOfLines={1}>{att.fileName}</Text>
            </View>
          ))}
        </>
      )}

      {/* Footer: reactions + comments */}
      {!isDeleted && (
        <View style={[wall.footer, { borderTopColor: colors.border }]}>
          <View style={wall.reactionsRow}>
            {reactions.map(([emoji, count]) => (
              <TouchableOpacity
                key={emoji}
                style={[wall.reactionPill, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => onReact(msg, emoji)}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                <Text style={[wall.reactionCount, { color: colors.foreground }]}>{count as number}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[wall.reactionPill, { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed' }]}
              onPress={() => onLongPress(msg)}
            >
              <Ionicons name="happy-outline" size={15} color={colors.mutedForeground} />
              <Ionicons name="add" size={11} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={wall.commentsBtn} onPress={() => onReplyCountPress(msg)}>
            <Ionicons name="chatbubble-outline" size={15} color="#2563eb" />
            <Text style={wall.commentsText}>
              {(msg.replyCount ?? 0) > 0
                ? `${msg.replyCount} ${msg.replyCount === 1 ? 'comment' : 'comments'}`
                : 'Comment'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

const wall = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginVertical: 6, borderRadius: 14, borderWidth: 1, padding: 14,
    shadowColor: '#001f3d', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#001f3d',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
  authorName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  postDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  deleted: { fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic' },
  imageWrap: { marginTop: 10 },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10, marginTop: 10 },
  fileName: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 8,
  },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1, alignItems: 'center' },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  reactionCount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  commentsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentsText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#2563eb' },
});

// ── Date separator ─────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={ds.row}>
      <View style={[ds.line, { backgroundColor: colors.border }]} />
      <Text style={[ds.label, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
        {label}
      </Text>
      <View style={[ds.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const ds = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8 },
  line: { flex: 1, height: 1 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingHorizontal: 10 },
});

// ── Compose bar ────────────────────────────────────────────────────────────────

interface ComposeBarProps {
  onSend: (text: string, attachment?: { objectPath: string; mimeType: string; fileName: string }) => Promise<void>;
  isSending: boolean;
  placeholder?: string;
}

function ComposeBar({ onSend, isSending, placeholder = 'Message…' }: ComposeBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [pendingAtt, setPendingAtt] = useState<{ objectPath: string; mimeType: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { mutateAsync: requestUrl } = useRequestUploadUrl();

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to photos to attach images.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const grant = await requestUrl({
        name: asset.fileName ?? 'photo.jpg',
        size: asset.fileSize ?? 0,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      // Fetch local file and upload to presigned URL
      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const uploadRes = await fetch(grant.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': grant.mimeType },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      setPendingAtt({ objectPath: grant.objectPath, mimeType: grant.mimeType, fileName: grant.fileName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Upload failed', 'Could not attach the image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (isSending || (!text.trim() && !pendingAtt)) return;
    const msg = text.trim();
    const att = pendingAtt;
    setText('');
    setPendingAtt(null);
    await onSend(msg, att ?? undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const canSend = (text.trim().length > 0 || !!pendingAtt) && !isSending;

  return (
    <View style={[cb.container, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.card }]}>
      {/* Pending attachment preview */}
      {pendingAtt && (
        <View style={[cb.attRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={16} color={colors.foreground} />
          <Text style={[cb.attName, { color: colors.foreground }]} numberOfLines={1}>
            {pendingAtt.fileName}
          </Text>
          <TouchableOpacity onPress={() => setPendingAtt(null)}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <View style={cb.row}>
        {/* Image picker button */}
        <TouchableOpacity
          onPress={pickImage}
          disabled={uploading}
          style={[cb.iconBtn, { backgroundColor: colors.muted }]}
        >
          {uploading
            ? <ActivityIndicator size="small" color={colors.mutedForeground} />
            : <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />}
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={[cb.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={[cb.sendBtn, { backgroundColor: canSend ? '#001f3d' : colors.muted }]}
        >
          {isSending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={18} color={canSend ? '#fff' : colors.mutedForeground} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9,
    fontFamily: 'Inter_400Regular', fontSize: 15,
    maxHeight: 120, minHeight: 38,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  attRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6,
  },
  attName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
});

// ── Thread modal ───────────────────────────────────────────────────────────────

function ThreadModal({
  parentMsg, channelId, myUserId, onClose,
}: {
  parentMsg: ChatMessage;
  channelId: number;
  myUserId: string | null | undefined;
  onClose: () => void;
}) {
  const insetsTop = useSafeAreaInsets().top;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: thread, isLoading } = useGetThread(parentMsg.id);
  const { mutateAsync: sendReply, isPending: isSending } = useCreateReply(parentMsg.id, channelId);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleSend = async (text: string, att?: { objectPath: string; mimeType: string; fileName: string }) => {
    if (!text && !att) return;
    await sendReply({
      content: text || undefined,
      attachments: att ? [att] : undefined,
    });
  };

  const senderLabel = (msg: ChatMessage) =>
    msg.senderStaffId === myUserId ? 'You' : (msg.senderName || msg.senderParentId?.split('@')[0] || 'Staff');

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <LinearGradient colors={['#001f3d', '#003366']} style={[th.header, { paddingTop: Platform.OS === 'android' ? insetsTop + 8 : Platform.OS === 'ios' ? 20 : 16 }]}>
          <TouchableOpacity onPress={onClose} style={th.headerBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={th.headerTitle}>Thread</Text>
          <View style={{ width: 44 }} />
        </LinearGradient>

        {/* Content */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Parent message */}
            <View style={[th.parentBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[th.parentLabel, { color: colors.mutedForeground }]}>Original message</Text>
            </View>
            <MessageBubble
              msg={parentMsg}
              isMe={parentMsg.senderStaffId === myUserId}
              showSender
              senderLabel={senderLabel(parentMsg)}
              onLongPress={() => {}}
              onAttachmentPress={setLightbox}
              onReplyCountPress={() => {}}
            />

            {/* Replies */}
            {thread?.replies.length ? (
              <>
                <View style={[th.parentBadge, { backgroundColor: colors.muted, borderColor: colors.border, marginTop: 8 }]}>
                  <Text style={[th.parentLabel, { color: colors.mutedForeground }]}>
                    {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
                {[...thread.replies].reverse().map(r => (
                  <MessageBubble
                    key={r.id}
                    msg={r}
                    isMe={r.senderStaffId === myUserId}
                    showSender
                    senderLabel={senderLabel(r)}
                    onLongPress={() => {}}
                    onAttachmentPress={setLightbox}
                    onReplyCountPress={() => {}}
                  />
                ))}
              </>
            ) : (
              <Text style={[th.noReplies, { color: colors.mutedForeground }]}>No replies yet</Text>
            )}
          </ScrollView>
        )}

        <ComposeBar
          onSend={handleSend}
          isSending={isSending}
          placeholder="Reply in thread…"
        />
      </KeyboardAvoidingView>

      {lightbox && <LightboxModal objectPath={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  );
}

const th = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  parentBadge: { marginHorizontal: 16, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4, alignSelf: 'center' },
  parentLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noReplies: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 24 },
});

// ── Conversation modal ─────────────────────────────────────────────────────────

function ConversationModal({
  channel, myUserId, onClose,
}: {
  channel: Channel;
  myUserId: string | null | undefined;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const {
    data, fetchNextPage, isFetchingNextPage, refetch, isLoading,
  } = useListMessages(channel.id);

  const { mutateAsync: sendMessage, isPending: isSending } = useCreateMessage(channel.id);
  const { mutateAsync: toggleReaction } = useToggleReaction(channel.id);

  const messages = useMemo(() => flattenMessages(data), [data]);
  const isNoticeboard = channel.type === 'noticeboard';

  // Polling — React Native has no EventSource
  useEffect(() => {
    const id = setInterval(
      () => qc.invalidateQueries({ queryKey: messagesQueryKey(channel.id) }),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [channel.id, qc]);

  // Reaction sheet state
  const [sheetMsg, setSheetMsg] = useState<ChatMessage | null>(null);
  const [threadMsg, setThreadMsg] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleSend = async (text: string, att?: { objectPath: string; mimeType: string; fileName: string }) => {
    if (!text && !att) return;
    await sendMessage({
      content: text || undefined,
      attachments: att ? [att] : undefined,
    });
  };

  const handleReact = async (emoji: string) => {
    if (!sheetMsg) return;
    await toggleReaction({ messageId: sheetMsg.id, emoji });
  };

  const handleCardReact = async (msg: ChatMessage, emoji: string) => {
    Haptics.selectionAsync();
    await toggleReaction({ messageId: msg.id, emoji });
  };

  const senderLabel = (msg: ChatMessage) => {
    if (msg.senderStaffId === myUserId) return 'You';
    return msg.senderName || msg.senderParentId?.split('@')[0] || 'Staff';
  };

  // On web, FlatList `inverted` is implemented via `scaleY(-1)` on the scroll
  // container only — each item must be counter-rotated so text reads correctly.
  const itemWrapStyle = Platform.OS === 'web'
    ? ({ transform: [{ scaleY: -1 }] } as const)
    : undefined;

  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    if (isNoticeboard) {
      return (
        <NoticeCard
          msg={item}
          senderLabel={senderLabel(item)}
          onLongPress={setSheetMsg}
          onAttachmentPress={setLightbox}
          onReplyCountPress={setThreadMsg}
          onReact={handleCardReact}
        />
      );
    }
    const showSep = needsDateSep(messages, index);
    const prev = messages[index - 1];
    const showSender = !prev || prev.senderStaffId !== item.senderStaffId || prev.senderParentId !== item.senderParentId;

    return (
      <View style={itemWrapStyle}>
        <MessageBubble
          msg={item}
          isMe={item.senderStaffId === myUserId}
          showSender={showSender}
          senderLabel={senderLabel(item)}
          onLongPress={setSheetMsg}
          onAttachmentPress={setLightbox}
          onReplyCountPress={setThreadMsg}
        />
        {showSep && <DateSeparator label={fmtDateSep(item.createdAt)} />}
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, myUserId, itemWrapStyle, isNoticeboard]);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <LinearGradient
          colors={['#001f3d', '#003366']}
          style={[conv.header, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}
        >
          <TouchableOpacity onPress={onClose} style={conv.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={conv.headerTitle} numberOfLines={1}>{channel.name}</Text>
            {isNoticeboard ? (
              <Text style={conv.headerSub}>
                {channel.ageGroup ? `${channel.ageGroup.toUpperCase()} · ` : ''}Club noticeboard
              </Text>
            ) : channel.ageGroup ? (
              <Text style={conv.headerSub}>{channel.ageGroup.toUpperCase()}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* Message list */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={m => String(m.id)}
            renderItem={renderItem}
            inverted={!isNoticeboard}
            contentContainerStyle={
              isNoticeboard
                ? { paddingVertical: 10, paddingBottom: 24 }
                : { paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' }
            }
            onEndReached={() => { if (!isFetchingNextPage) fetchNextPage(); }}
            onEndReachedThreshold={0.3}
            onRefresh={refetch}
            refreshing={false}
            ListFooterComponent={
              isFetchingNextPage
                ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} />
                : null
            }
            ListEmptyComponent={
              <Animated.View entering={FadeIn} style={conv.emptyWrap}>
                <Ionicons name={isNoticeboard ? 'megaphone-outline' : 'chatbubble-outline'} size={40} color={colors.mutedForeground} />
                <Text style={[conv.emptyText, { color: colors.mutedForeground }]}>
                  {isNoticeboard ? 'No notices posted yet.' : 'No messages yet. Say hello!'}
                </Text>
              </Animated.View>
            }
          />
        )}

        <ComposeBar onSend={handleSend} isSending={isSending} placeholder={isNoticeboard ? 'Post a notice\u2026' : undefined} />
      </KeyboardAvoidingView>

      {/* Reaction sheet */}
      <ReactionSheet
        visible={!!sheetMsg}
        onReact={handleReact}
        onReply={() => sheetMsg && setThreadMsg(sheetMsg)}
        onClose={() => setSheetMsg(null)}
      />

      {/* Thread modal */}
      {threadMsg && (
        <ThreadModal
          parentMsg={threadMsg}
          channelId={channel.id}
          myUserId={myUserId}
          onClose={() => setThreadMsg(null)}
        />
      )}

      {/* Lightbox */}
      {lightbox && <LightboxModal objectPath={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  );
}

const conv = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center' },
});

// ── Channel row ────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<Channel['type'], string> = {
  noticeboard: 'megaphone-outline',
  direct: 'person-outline',
  group: 'people-outline',
  staff: 'shield-outline',
};

function ChannelRow({ channel, onPress }: { channel: Channel; onPress: () => void }) {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';
  const icon = CHANNEL_ICONS[channel.type];

  return (
    <TouchableOpacity
      style={[cr.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[cr.iconWrap, { backgroundColor: '#001f3d15' }]}>
        {isIOS ? (
          <SymbolView
            name={channel.type === 'noticeboard' ? 'megaphone.fill' : channel.type === 'direct' ? 'person.fill' : 'person.2.fill'}
            tintColor="#001f3d"
            size={18}
          />
        ) : (
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cr.name, { color: colors.foreground }]} numberOfLines={1}>
          {channel.name}
        </Text>
        {channel.ageGroup && (
          <Text style={[cr.sub, { color: colors.mutedForeground }]}>{channel.ageGroup.toUpperCase()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[sh.wrap, { backgroundColor: colors.muted }]}>
      <Text style={[sh.title, { color: colors.mutedForeground }]}>{title}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
});

// ── New message modal ──────────────────────────────────────────────────────────

interface ParentRow {
  email: string;
  playerParent: string | null;
  children: string[];
  ageGroups: string[];
}

function NewMessageModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (channelId: number) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [creatingEmail, setCreatingEmail] = useState<string | null>(null);

  const { data: members = [], isLoading } = useListMembers({});
  const { mutateAsync: createChannel } = useCreateChannel();

  // De-duplicate members by parent email, collecting all children's names.
  const parents = useMemo<ParentRow[]>(() => {
    const map = new Map<string, ParentRow>();
    for (const m of members as Member[]) {
      if (!m.playerEmail) continue;
      if (!map.has(m.playerEmail)) {
        map.set(m.playerEmail, {
          email: m.playerEmail,
          playerParent: m.playerParent ?? null,
          children: [],
          ageGroups: [],
        });
      }
      const row = map.get(m.playerEmail)!;
      if (m.playerName && !row.children.includes(m.playerName)) row.children.push(m.playerName);
      if (m.ageGroup && !row.ageGroups.includes(m.ageGroup)) row.ageGroups.push(m.ageGroup);
    }
    return Array.from(map.values());
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(p =>
      p.playerParent?.toLowerCase().includes(q)
      || p.children.some(c => c.toLowerCase().includes(q))
      || p.email.toLowerCase().includes(q),
    );
  }, [parents, search]);

  const displayName = (p: ParentRow) =>
    p.playerParent
      || (p.children.length ? `Parent of ${p.children.join(', ')}` : p.email.split('@')[0]);

  const handleSelect = async (p: ParentRow) => {
    if (creatingEmail) return;
    setCreatingEmail(p.email);
    try {
      Haptics.selectionAsync();
      const channel = await createChannel({
        type: 'direct',
        name: displayName(p),
        memberEmails: [p.email],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(channel.id);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not start message', 'Something went wrong. Please try again.');
    } finally {
      setCreatingEmail(null);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <LinearGradient
          colors={['#001f3d', '#003366']}
          style={[nm.header, { paddingTop: Platform.OS === 'android' ? insets.top + 8 : Platform.OS === 'ios' ? 20 : 16 }]}
        >
          <TouchableOpacity onPress={onClose} style={nm.headerBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <Text style={nm.headerTitle}>New message</Text>
          <View style={{ width: 44 }} />
        </LinearGradient>

        {/* Search */}
        <View style={[nm.searchWrap, { borderBottomColor: colors.border }]}>
          <View style={[nm.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[nm.searchInput, { color: colors.foreground }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search players or parents…"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 }}>
            <Ionicons name="people-outline" size={44} color={colors.mutedForeground} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.foreground }}>No parents found</Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>
              Try a different search term.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={p => p.email}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => {
              const busy = creatingEmail === item.email;
              const subtitle = item.children.length
                ? item.children.join(', ') + (item.ageGroups.length ? ` · ${item.ageGroups.join(', ')}` : '')
                : item.email;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!!creatingEmail}
                  onPress={() => handleSelect(item)}
                  style={[nm.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={nm.avatar}>
                    <Text style={nm.avatarText}>{initialsOf(displayName(item))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[nm.rowName, { color: colors.foreground }]} numberOfLines={1}>
                      {displayName(item)}
                    </Text>
                    <Text style={[nm.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>
                  {busy
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const nm = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 16,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff' },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginVertical: 4, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#001f3d',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
  rowName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});

// ── Main tab screen ────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const isIOS = Platform.OS === 'ios';

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 60;

  const { data: channels = [], isLoading, refetch, isRefetching } = useListChannels();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const myUserId = user?.id ?? null;
  const grouped = useMemo(() => groupChannels(channels), [channels]);

  // Build FlatList data: sections interleaved with channels
  type ListItem =
    | { kind: 'header'; key: string; title: string }
    | { kind: 'channel'; key: string; channel: Channel };

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    if (grouped.noticeboard.length) {
      items.push({ kind: 'header', key: 'h-notice', title: 'Notice Boards' });
      grouped.noticeboard.forEach(c => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    if (grouped.direct.length) {
      items.push({ kind: 'header', key: 'h-dm', title: 'Direct Messages' });
      grouped.direct.forEach(c => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    if (grouped.group.length) {
      items.push({ kind: 'header', key: 'h-group', title: 'Group Chats' });
      grouped.group.forEach(c => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    return items;
  }, [grouped]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'header') return <SectionHeader title={item.title} />;
    return (
      <ChannelRow
        channel={item.channel}
        onPress={() => { Haptics.selectionAsync(); setActiveChannel(item.channel); }}
      />
    );
  }, []);

  const handleChannelCreated = useCallback(async (channelId: number) => {
    setShowNewMessage(false);
    const { data: fresh = [] } = await refetch();
    const created = fresh.find(c => c.id === channelId);
    if (created) setActiveChannel(created);
  }, [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Gradient header */}
      <LinearGradient colors={['#001f3d', '#003366']} style={[ms.header, { paddingTop: topPad + 16 }]}>
        <View style={{ height: 3, width: 32, backgroundColor: '#f6a800', borderRadius: 2, marginBottom: 12 }} />
        <View style={ms.headerRow}>
          <View>
            <Text style={ms.headerTitle}>Messages</Text>
            <Text style={ms.headerSub}>{channels.length} channel{channels.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setShowNewMessage(true); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="New message"
          >
            {isIOS ? (
              <SymbolView name="square.and.pencil" tintColor="#f6a800" size={22} />
            ) : (
              <Ionicons name="create-outline" size={22} color="#f6a800" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Channel list */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listData.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.foreground }}>No channels yet</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mutedForeground, textAlign: 'center' }}>
            Channels will appear here once they've been created from the web dashboard.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Conversation modal */}
      {activeChannel && (
        <ConversationModal
          channel={activeChannel}
          myUserId={myUserId}
          onClose={() => setActiveChannel(null)}
        />
      )}

      {/* New message modal */}
      {showNewMessage && (
        <NewMessageModal
          onClose={() => setShowNewMessage(false)}
          onCreated={handleChannelCreated}
        />
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#fff' },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
});
