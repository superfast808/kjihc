/**
 * Parent Messages tab — notice boards + DMs from staff.
 * Parents can reply to noticeboard threads and send messages in DMs.
 * Parents cannot post top-level notices (compose bar hidden on noticeboard root).
 */
import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, Alert, TextInput, Modal,
  KeyboardAvoidingView, Pressable, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
const LOGO = require('@/assets/images/club-logo.png');
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useParentAuth } from '@/context/ParentAuthContext';
import { useUnread } from '@/context/UnreadContext';
import { useColors } from '@/hooks/useColors';
import { getBaseUrl } from '@workspace/api-client-react';
import {
  useParentListChannels,
  useParentListMessages,
  useParentCreateMessage,
  useParentGetThread,
  useParentToggleReaction,
  useParentRequestUploadUrl,
  pMessagesKey,
  pThreadKey,
  type Channel,
  type ChatMessage,
  type Attachment,
} from '@/hooks/useParentMessaging';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const POLL_INTERVAL_MS = 8_000;
const VISITED_KEY = 'kjihc_parent_visited_channels';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
    noticeboard: channels.filter((c) => c.type === 'noticeboard'),
    direct: channels.filter((c) => c.type === 'direct'),
    group: channels.filter((c) => c.type === 'group'),
  };
}

function flatMessages(data: ReturnType<typeof useParentListMessages>['data']): ChatMessage[] {
  return data?.pages.flatMap((p) => p) ?? [];
}

// Oldest-first order (no `inverted`): show a date header above the first message
// of each day, i.e. when the day changes vs the previous item (or at index 0).
function needsDateSep(msgs: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  return new Date(msgs[index].createdAt).toDateString() !==
         new Date(msgs[index - 1].createdAt).toDateString();
}

// ── Storage image ─────────────────────────────────────────────────────────────

function StorageImage({ objectPath, style, onPress }: { objectPath: string; style?: object; onPress?: () => void }) {
  const { token } = useParentAuth();
  const base = getBaseUrl() ?? '';
  const uri = `${base}/api/storage/objects/${objectPath.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const img = (
    <Image
      source={{ uri, headers }}
      style={[{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10 }, style]}
      contentFit="cover" transition={200}
    />
  );
  if (!onPress) return img;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{img}</TouchableOpacity>;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

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

// ── Reaction sheet ────────────────────────────────────────────────────────────

function ReactionSheet({ visible, onReact, onReply, onClose }: {
  visible: boolean; onReact: (emoji: string) => void; onReply?: () => void; onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={rs.backdrop} onPress={onClose}>
        <Pressable style={[rs.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={rs.emojiRow}>
            {QUICK_REACTIONS.map((e) => (
              <TouchableOpacity key={e} style={rs.emojiBtn} onPress={() => { Haptics.selectionAsync(); onReact(e); onClose(); }}>
                <Text style={rs.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {onReply && (
            <TouchableOpacity style={[rs.replyRow, { borderTopColor: colors.border }]} onPress={() => { onReply(); onClose(); }}>
              <Ionicons name="return-down-back" size={18} color={colors.foreground} />
              <Text style={[rs.replyText, { color: colors.foreground }]}>Reply in thread</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const rs = StyleSheet.create({
  backdrop:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:     { marginHorizontal: 16, marginBottom: 32, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  emojiRow:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8 },
  emojiBtn:  { padding: 8 },
  emoji:     { fontSize: 28 },
  replyRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1 },
  replyText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe, showSender, onLongPress, onAttachmentPress, onReplyCountPress }: {
  msg: ChatMessage; isMe: boolean; showSender: boolean;
  onLongPress: (msg: ChatMessage) => void;
  onAttachmentPress: (objectPath: string) => void;
  onReplyCountPress?: (msg: ChatMessage) => void;
}) {
  const colors = useColors();
  const isDeleted = msg.deletedAt !== null;
  const hasReactions = Object.keys(msg.reactions ?? {}).length > 0;

  return (
    <View style={[bub.row, isMe && bub.rowMe]}>
      <View style={[bub.wrap, isMe && bub.wrapMe, { maxWidth: '82%' }]}>
        {showSender && !isMe && (
          <Text style={[bub.sender, { color: colors.secondary }]}>{msg.senderName || 'Staff'}</Text>
        )}
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
                  <Text style={[bub.text, { color: isMe ? '#fff' : colors.foreground }]}>{msg.content}</Text>
                ) : null}
                {(msg.attachments ?? []).map((att: Attachment) => (
                  <View key={att.id} style={{ marginTop: msg.content ? 8 : 0 }}>
                    {att.mimeType.startsWith('image/') ? (
                      <StorageImage objectPath={att.objectPath} onPress={() => onAttachmentPress(att.objectPath)} style={{ borderRadius: 8 }} />
                    ) : (
                      <View style={[bub.filePill, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : colors.muted }]}>
                        <Ionicons name="document-outline" size={16} color={isMe ? '#fff' : colors.foreground} />
                        <Text style={[bub.fileName, { color: isMe ? '#fff' : colors.foreground }]} numberOfLines={1}>{att.fileName}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>
        <Text style={[bub.time, { color: colors.mutedForeground }, isMe && { alignSelf: 'flex-end' }]}>
          {fmtTime(msg.createdAt)}
        </Text>
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
        {(msg.replyCount ?? 0) > 0 && onReplyCountPress && (
          <TouchableOpacity style={[bub.replyCount, isMe && bub.replyCountMe]} onPress={() => onReplyCountPress(msg)}>
            <Ionicons name="return-down-back" size={12} color={colors.secondary} />
            <Text style={[bub.replyCountText, { color: colors.secondary }]}>
              {msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const bub = StyleSheet.create({
  row:          { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 3 },
  rowMe:        { justifyContent: 'flex-end' },
  wrap:         { alignItems: 'flex-start' },
  wrapMe:       { alignItems: 'flex-end' },
  sender:       { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: 3, marginLeft: 2 },
  bubble:       { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  text:         { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  deletedText:  { fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic' },
  time:         { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3, marginLeft: 2 },
  filePill:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 8 },
  fileName:     { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  reactions:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginLeft: 2 },
  reactionsMe:  { justifyContent: 'flex-end', marginLeft: 0, marginRight: 2 },
  reactionPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmoji:{ fontSize: 14 },
  reactionCount:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  replyCount:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginLeft: 2 },
  replyCountMe: { marginLeft: 0, marginRight: 2 },
  replyCountText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

// ── Noticeboard wall post card ────────────────────────────────────────────────

function initialsOf(name: string) {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
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

function NoticeCard({ msg, onLongPress, onAttachmentPress, onCommentsPress, onReact }: {
  msg: ChatMessage;
  onLongPress: (msg: ChatMessage) => void;
  onAttachmentPress: (objectPath: string) => void;
  onCommentsPress: (msg: ChatMessage) => void;
  onReact: (msg: ChatMessage, emoji: string) => void;
}) {
  const colors = useColors();
  const isDeleted = msg.deletedAt !== null;
  const reactions = Object.entries(msg.reactions ?? {});
  const sender = msg.senderName || 'Staff';
  const imageAtts = (msg.attachments ?? []).filter((a: Attachment) => a.mimeType.startsWith('image/'));
  const fileAtts = (msg.attachments ?? []).filter((a: Attachment) => !a.mimeType.startsWith('image/'));

  return (
    <Pressable
      onLongPress={() => { if (!isDeleted) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLongPress(msg); } }}
      delayLongPress={300}
      style={[wall.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={wall.authorRow}>
        <View style={wall.avatar}>
          <Text style={wall.avatarText}>{initialsOf(sender)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wall.authorName, { color: colors.foreground }]}>{sender}</Text>
          <Text style={[wall.postDate, { color: colors.mutedForeground }]}>{fmtWallDate(msg.createdAt)}</Text>
        </View>
        <Ionicons name="megaphone" size={16} color="#f6a800" />
      </View>
      {isDeleted ? (
        <Text style={[wall.deleted, { color: colors.mutedForeground }]}>This notice was removed</Text>
      ) : (
        <>
          {msg.content ? <Text style={[wall.body, { color: colors.foreground }]}>{msg.content}</Text> : null}
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
              style={[wall.reactionPill, { backgroundColor: 'transparent', borderColor: colors.border }]}
              onPress={() => onLongPress(msg)}
            >
              <Ionicons name="happy-outline" size={15} color={colors.mutedForeground} />
              <Ionicons name="add" size={11} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={wall.commentsBtn} onPress={() => onCommentsPress(msg)}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.secondary} />
            <Text style={[wall.commentsText, { color: colors.secondary }]}>
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#001f3d', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
  authorName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  postDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  deleted: { fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic' },
  imageWrap: { marginTop: 10 },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10, marginTop: 10 },
  fileName: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 8 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1, alignItems: 'center' },
  reactionPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  reactionCount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  commentsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentsText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

// ── Date separator ────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={ds.row}>
      <View style={[ds.line, { backgroundColor: colors.border }]} />
      <Text style={[ds.label, { color: colors.mutedForeground, backgroundColor: colors.background }]}>{label}</Text>
      <View style={[ds.line, { backgroundColor: colors.border }]} />
    </View>
  );
}
const ds = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8 },
  line:  { flex: 1, height: 1 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, paddingHorizontal: 10 },
});

// ── Compose bar ───────────────────────────────────────────────────────────────

function ComposeBar({ onSend, isSending, placeholder = 'Message…' }: {
  onSend: (text: string, att?: { objectPath: string; mimeType: string; fileName: string }) => Promise<void>;
  isSending: boolean; placeholder?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [pendingAtt, setPendingAtt] = useState<{ objectPath: string; mimeType: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { mutateAsync: requestUrl } = useParentRequestUploadUrl();

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to photos to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const grant = await requestUrl({ name: asset.fileName ?? 'photo.jpg', size: asset.fileSize ?? 0, contentType: asset.mimeType ?? 'image/jpeg' });
      const blob = await (await fetch(asset.uri)).blob();
      const res = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': grant.mimeType }, body: blob });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
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
    const msg = text.trim(); const att = pendingAtt;
    setText(''); setPendingAtt(null);
    try {
      await onSend(msg, att ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setText(msg); setPendingAtt(att);
      Alert.alert('Failed to send', 'Your message could not be sent. Please try again.');
    }
  };

  const canSend = (text.trim().length > 0 || !!pendingAtt) && !isSending;

  return (
    <View style={[cb.container, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.card }]}>
      {pendingAtt && (
        <View style={[cb.attRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={16} color={colors.foreground} />
          <Text style={[cb.attName, { color: colors.foreground }]} numberOfLines={1}>{pendingAtt.fileName}</Text>
          <TouchableOpacity onPress={() => setPendingAtt(null)}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}
      <View style={cb.row}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} style={[cb.iconBtn, { backgroundColor: colors.muted }]}>
          {uploading ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />}
        </TouchableOpacity>
        <TextInput
          style={[cb.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
          value={text} onChangeText={setText} placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground} multiline maxLength={2000}
        />
        <TouchableOpacity onPress={handleSend} disabled={!canSend} style={[cb.sendBtn, { backgroundColor: canSend ? colors.secondary : colors.muted }]}>
          {isSending ? <ActivityIndicator size="small" color={colors.secondaryForeground} /> : <Ionicons name="send" size={18} color={canSend ? colors.secondaryForeground : colors.mutedForeground} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const cb = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 12 },
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 4 },
  iconBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  input:     { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontFamily: 'Inter_400Regular', fontSize: 15, maxHeight: 120, minHeight: 38 },
  sendBtn:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  attRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6 },
  attName:   { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
});

// ── Thread modal ──────────────────────────────────────────────────────────────

function ThreadModal({ parentMsg, channelId, myEmail, onClose }: {
  parentMsg: ChatMessage; channelId: number; myEmail: string | null; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: thread, isLoading } = useParentGetThread(parentMsg.id);
  const { mutateAsync: createMessage, isPending: isSending } = useParentCreateMessage(channelId);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => qc.invalidateQueries({ queryKey: pThreadKey(parentMsg.id) }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [parentMsg.id, qc]);

  const handleSend = async (text: string, att?: { objectPath: string; mimeType: string; fileName: string }) => {
    if (!text && !att) return;
    await createMessage({ content: text || undefined, parentMessageId: parentMsg.id, attachments: att ? [att] : undefined });
    qc.invalidateQueries({ queryKey: pMessagesKey(channelId) });
  };

  const isMe = (msg: ChatMessage) => msg.senderParentId !== null && msg.senderParentId === myEmail;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LinearGradient colors={['#001f3d', '#003366']} style={[tm.header, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={tm.headerBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={tm.headerTitle}>Thread</Text>
          <View style={{ width: 44 }} />
        </LinearGradient>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }} keyboardShouldPersistTaps="handled">
            <View style={[tm.badge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[tm.badgeText, { color: colors.mutedForeground }]}>Original message</Text>
            </View>
            <MessageBubble msg={parentMsg} isMe={isMe(parentMsg)} showSender={!isMe(parentMsg)} onLongPress={() => {}} onAttachmentPress={setLightbox} />
            {(thread?.replies?.length ?? 0) > 0 && (
              <>
                <View style={[tm.badge, { backgroundColor: colors.muted, borderColor: colors.border, marginTop: 8 }]}>
                  <Text style={[tm.badgeText, { color: colors.mutedForeground }]}>{thread!.replies.length} {thread!.replies.length === 1 ? 'reply' : 'replies'}</Text>
                </View>
                {[...(thread?.replies ?? [])].reverse().map((r) => (
                  <MessageBubble key={r.id} msg={r} isMe={isMe(r)} showSender={!isMe(r)} onLongPress={() => {}} onAttachmentPress={setLightbox} />
                ))}
              </>
            )}
            {(thread?.replies?.length ?? 0) === 0 && !isLoading && (
              <Text style={[tm.noReplies, { color: colors.mutedForeground }]}>No replies yet</Text>
            )}
          </ScrollView>
        )}
        <ComposeBar onSend={handleSend} isSending={isSending} placeholder="Reply in thread…" />
      </KeyboardAvoidingView>
      {lightbox && <LightboxModal objectPath={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  );
}
const tm = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  badge:     { marginHorizontal: 16, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 4, alignSelf: 'center' },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  noReplies: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 24 },
});

// ── Conversation modal ────────────────────────────────────────────────────────

function ConversationModal({ channel, myEmail, onClose }: {
  channel: Channel; myEmail: string | null; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isNoticeboard = channel.type === 'noticeboard';

  const { data, fetchNextPage, isFetchingNextPage, refetch, isLoading } = useParentListMessages(channel.id);
  const { mutateAsync: sendMessage, isPending: isSending } = useParentCreateMessage(channel.id);
  const { mutateAsync: toggleReaction } = useParentToggleReaction(channel.id);

  // Chats: reverse so oldest is first (rendered without `inverted`, which is buggy on web).
  // Noticeboard wall: keep newest-first like a feed.
  const messages = useMemo(
    () => (isNoticeboard ? flatMessages(data) : [...flatMessages(data)].reverse()),
    [data, isNoticeboard],
  );
  const listRef = React.useRef<FlatList<ChatMessage>>(null);
  // Scroll to bottom when the first page loads (chats only)
  useEffect(() => {
    if (!isNoticeboard && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0]);

  useEffect(() => {
    const id = setInterval(() => qc.invalidateQueries({ queryKey: pMessagesKey(channel.id) }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [channel.id, qc]);

  const [sheetMsg, setSheetMsg] = useState<ChatMessage | null>(null);
  const [threadMsg, setThreadMsg] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const isMe = useCallback((msg: ChatMessage) => msg.senderParentId !== null && msg.senderParentId === myEmail, [myEmail]);

  const handleSend = async (text: string, att?: { objectPath: string; mimeType: string; fileName: string }) => {
    if (!text && !att) return;
    await sendMessage({ content: text || undefined, attachments: att ? [att] : undefined });
  };

  const handleReact = async (emoji: string) => {
    if (!sheetMsg) return;
    await toggleReaction({ messageId: sheetMsg.id, emoji });
  };

  const handleCardReact = async (msg: ChatMessage, emoji: string) => {
    Haptics.selectionAsync();
    await toggleReaction({ messageId: msg.id, emoji });
  };

  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    if (isNoticeboard) {
      return (
        <NoticeCard
          msg={item}
          onLongPress={setSheetMsg}
          onAttachmentPress={setLightbox}
          onCommentsPress={setThreadMsg}
          onReact={handleCardReact}
        />
      );
    }
    // oldest-first: prev item is the one above (older)
    const prev = messages[index - 1];
    const showSender = !prev || prev.senderStaffId !== item.senderStaffId || prev.senderParentId !== item.senderParentId;
    const showSep = needsDateSep(messages, index);
    return (
      <>
        {showSep && <DateSeparator label={fmtDateSep(item.createdAt)} />}
        <MessageBubble msg={item} isMe={isMe(item)} showSender={showSender} onLongPress={setSheetMsg}
          onAttachmentPress={setLightbox} onReplyCountPress={isNoticeboard ? setThreadMsg : undefined} />
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, myEmail, isNoticeboard]);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LinearGradient colors={['#001f3d', '#003366']} style={[conv.header, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={conv.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={conv.headerTitle} numberOfLines={1}>{channel.name}</Text>
            {channel.ageGroup && <Text style={conv.headerSub}>{channel.ageGroup.toUpperCase()}</Text>}
          </View>
          {isNoticeboard && (
            <View style={[conv.badge, { backgroundColor: 'rgba(246,168,0,0.25)' }]}>
              <Text style={conv.badgeText}>Read &amp; comment</Text>
            </View>
          )}
        </LinearGradient>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages} keyExtractor={(m) => String(m.id)} renderItem={renderItem}
            contentContainerStyle={
              isNoticeboard
                ? { paddingVertical: 10, paddingBottom: 24 }
                : { paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' }
            }
            onEndReached={isNoticeboard ? () => { if (!isFetchingNextPage) fetchNextPage(); } : undefined}
            onEndReachedThreshold={0.3}
            onRefresh={refetch} refreshing={false}
            ListHeaderComponent={!isNoticeboard && isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : null}
            ListFooterComponent={isNoticeboard && isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={colors.primary} /> : null}
            ListEmptyComponent={
              <Animated.View entering={FadeIn} style={conv.empty}>
                <Ionicons name={isNoticeboard ? 'megaphone-outline' : 'chatbubble-outline'} size={40} color={colors.mutedForeground} />
                <Text style={[conv.emptyText, { color: colors.mutedForeground }]}>
                  {isNoticeboard ? 'No notices posted yet' : 'No messages yet'}
                </Text>
              </Animated.View>
            }
          />
        )}
        {!isNoticeboard && <ComposeBar onSend={handleSend} isSending={isSending} />}
      </KeyboardAvoidingView>
      <ReactionSheet
        visible={!!sheetMsg} onReact={handleReact}
        onReply={isNoticeboard ? () => sheetMsg && setThreadMsg(sheetMsg) : undefined}
        onClose={() => setSheetMsg(null)}
      />
      {threadMsg && <ThreadModal parentMsg={threadMsg} channelId={channel.id} myEmail={myEmail} onClose={() => setThreadMsg(null)} />}
      {lightbox && <LightboxModal objectPath={lightbox} onClose={() => setLightbox(null)} />}
    </Modal>
  );
}
const conv = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  headerBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  badge:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#f6a800' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText:   { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center' },
});

// ── Channel row ───────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<Channel['type'], string> = {
  noticeboard: 'megaphone-outline',
  direct:      'chatbubble-ellipses-outline',
  group:       'people-outline',
  staff:       'shield-outline',
};

function ChannelRow({ channel, isUnread, onPress }: { channel: Channel; isUnread: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[cr.row, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[cr.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Ionicons name={CHANNEL_ICONS[channel.type] as any} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={cr.nameRow}>
          <Text style={[cr.name, { color: colors.foreground }, isUnread && cr.nameUnread]} numberOfLines={1}>{channel.name}</Text>
          {isUnread && <View style={[cr.dot, { backgroundColor: colors.secondary }]} />}
        </View>
        {channel.ageGroup && <Text style={[cr.sub, { color: colors.mutedForeground }]}>{channel.ageGroup.toUpperCase()}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}
const cr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:       { fontFamily: 'Inter_400Regular', fontSize: 15 },
  nameUnread: { fontFamily: 'Inter_700Bold' },
  sub:        { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
});

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[sh.wrap, { backgroundColor: colors.muted }]}>
      <Text style={[sh.title, { color: colors.mutedForeground }]}>{title}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  wrap:  { paddingHorizontal: 16, paddingVertical: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, email } = useParentAuth();
  const { setUnreadCount } = useUnread();

  const topPad  = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const tabBarH = Platform.OS === 'web' ? 84 : 80;

  const { data: channels = [], isLoading, refetch, isRefetching } = useParentListChannels();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const [visitedIds, setVisitedIds] = useState<Set<number>>(new Set());
  const visitedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(VISITED_KEY).then((raw) => {
      if (raw) {
        try {
          const ids: number[] = JSON.parse(raw);
          visitedRef.current = new Set(ids);
          setVisitedIds(new Set(ids));
        } catch { /* ignore */ }
      }
    });
  }, []);

  useEffect(() => {
    const unread = channels.filter((c) => !visitedIds.has(c.id)).length;
    setUnreadCount(unread);
  }, [channels, visitedIds, setUnreadCount]);

  const markVisited = useCallback((channelId: number) => {
    if (visitedRef.current.has(channelId)) return;
    visitedRef.current = new Set([...visitedRef.current, channelId]);
    setVisitedIds(new Set(visitedRef.current));
    AsyncStorage.setItem(VISITED_KEY, JSON.stringify([...visitedRef.current])).catch(() => {});
  }, []);

  const handleOpenChannel = (channel: Channel) => {
    Haptics.selectionAsync();
    markVisited(channel.id);
    setActiveChannel(channel);
  };

  const grouped = useMemo(() => groupChannels(channels), [channels]);

  type ListItem = { kind: 'header'; key: string; title: string } | { kind: 'channel'; key: string; channel: Channel };

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    if (grouped.noticeboard.length) {
      items.push({ kind: 'header', key: 'h-notice', title: 'Notice Boards' });
      grouped.noticeboard.forEach((c) => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    if (grouped.direct.length) {
      items.push({ kind: 'header', key: 'h-dm', title: 'Messages from Staff' });
      grouped.direct.forEach((c) => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    if (grouped.group.length) {
      items.push({ kind: 'header', key: 'h-group', title: 'Group Chats' });
      grouped.group.forEach((c) => items.push({ kind: 'channel', key: `c-${c.id}`, channel: c }));
    }
    return items;
  }, [grouped]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'header') return <SectionHeader title={item.title} />;
    return (
      <ChannelRow channel={item.channel} isUnread={!visitedIds.has(item.channel.id)} onPress={() => handleOpenChannel(item.channel)} />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedIds]);

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mutedForeground }}>Sign in to view messages.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={['#001f3d', '#003366']} style={[ms.header, { paddingTop: topPad + 4 }]}>
        <View style={ms.headerRow}>
          <View>
            <View style={ms.goldAccent} />
            <Text style={ms.headerTitle}>Messages</Text>
            <Text style={ms.headerSub}>{channels.length} channel{channels.length !== 1 ? 's' : ''}</Text>
          </View>
          <Image source={LOGO} style={ms.headerLogo} contentFit="contain" />
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listData.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.foreground }}>No messages yet</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.mutedForeground, textAlign: 'center' }}>
            Club notices and messages from staff will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData} keyExtractor={(item) => item.key} renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: bottomPad + tabBarH + 8 }}
          onRefresh={refetch} refreshing={isRefetching} showsVerticalScrollIndicator={false}
        />
      )}

      {activeChannel && (
        <ConversationModal channel={activeChannel} myEmail={email} onClose={() => setActiveChannel(null)} />
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  header:      { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLogo:  { width: 72, height: 34 },
  goldAccent:  { width: 28, height: 3, borderRadius: 2, backgroundColor: '#f6a800', marginBottom: 8 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#fff' },
  headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
});
