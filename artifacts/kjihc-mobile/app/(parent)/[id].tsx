import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGetParentChildren, useParentPatchChild } from '@workspace/api-client-react';
import type { MemberDetail } from '@workspace/api-client-react';
import { useParentAuth } from '@/context/ParentAuthContext';
import { useQueryClient } from '@tanstack/react-query';

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  colors,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldMultiline,
          { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function EditChildScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = parseInt(id ?? '0', 10);

  const { token } = useParentAuth();
  const queryClient = useQueryClient();

  const { data: children, isLoading } = useGetParentChildren(
    { token: token ?? '' }
  );

  const child = children?.find((c: MemberDetail) => c.id === childId);

  const { mutateAsync: patchChild } = useParentPatchChild();
  const [saving, setSaving] = useState(false);

  // Form state — only fields parents are allowed to update
  const [playerParent, setPlayerParent] = useState(child?.playerParent ?? '');
  const [playerContactTel, setPlayerContactTel] = useState(child?.playerContactTel ?? '');
  const [playerAddress1, setPlayerAddress1] = useState(child?.playerAddress1 ?? '');
  const [playerAddress2, setPlayerAddress2] = useState(child?.playerAddress2 ?? '');
  const [playerCity, setPlayerCity] = useState(child?.playerCity ?? '');
  const [playerPost, setPlayerPost] = useState(child?.playerPost ?? '');
  const [playerMedicalnotes, setPlayerMedicalnotes] = useState(child?.playerMedicalnotes ?? '');
  const [playerMedication, setPlayerMedication] = useState(child?.playerMedication ?? '');

  // Sync state when data loads
  React.useEffect(() => {
    if (child) {
      setPlayerParent(child.playerParent ?? '');
      setPlayerContactTel(child.playerContactTel ?? '');
      setPlayerAddress1(child.playerAddress1 ?? '');
      setPlayerAddress2(child.playerAddress2 ?? '');
      setPlayerCity(child.playerCity ?? '');
      setPlayerPost(child.playerPost ?? '');
      setPlayerMedicalnotes(child.playerMedicalnotes ?? '');
      setPlayerMedication(child.playerMedication ?? '');
    }
  }, [child?.id]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(parent)/(tabs)/child'));

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await patchChild({
        id: childId,
        data: {
          token: token!,
          playerParent,
          playerContactTel,
          playerAddress1,
          playerAddress2,
          playerCity,
          playerPost,
          playerMedicalnotes,
          playerMedication,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['getParentChildren'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Details updated successfully.', [
        { text: 'OK', onPress: goBack },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Child not found</Text>
        <TouchableOpacity onPress={goBack}>
          <Text style={[styles.link, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{child.playerName}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Player info (read-only) */}
        <View style={[styles.infoSection, { backgroundColor: colors.muted }]}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Age Group</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {child.ageGroup}
            {child.addAgeGroup ? ` · also trains with ${child.addAgeGroup}` : ''}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONTACT DETAILS</Text>

        <FormField label="Parent / Guardian name" value={playerParent} onChangeText={setPlayerParent} colors={colors} />
        <FormField label="Contact phone" value={playerContactTel} onChangeText={setPlayerContactTel} keyboardType="phone-pad" colors={colors} />
        <FormField label="Address line 1" value={playerAddress1} onChangeText={setPlayerAddress1} colors={colors} />
        <FormField label="Address line 2 (optional)" value={playerAddress2} onChangeText={setPlayerAddress2} colors={colors} />
        <FormField label="City / Town" value={playerCity} onChangeText={setPlayerCity} colors={colors} />
        <FormField label="Postcode" value={playerPost} onChangeText={setPlayerPost} colors={colors} />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MEDICAL INFORMATION</Text>
        <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
          This information is kept confidential and only visible to club staff.
        </Text>

        <FormField
          label="Medical notes"
          value={playerMedicalnotes}
          onChangeText={setPlayerMedicalnotes}
          placeholder="Any medical conditions, allergies, or special requirements"
          colors={colors}
          multiline
        />
        <FormField
          label="Medication"
          value={playerMedication}
          onChangeText={setPlayerMedication}
          placeholder="Any regular medication"
          colors={colors}
          multiline
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, flex: 1, textAlign: 'center' },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  form: { paddingHorizontal: 16, paddingTop: 20, gap: 4 },
  infoSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 10, padding: 14, marginBottom: 20,
  },
  infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  infoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
  sectionNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, marginBottom: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 6 },
  fieldInput: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  fieldMultiline: { minHeight: 80, paddingTop: 11 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
