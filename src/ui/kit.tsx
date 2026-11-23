// Shared look: dark, large touch targets (min 52 px), one accent colour for the main action.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const C = {
  bg: '#0b0f14', card: '#131a22', card2: '#18212b', line: '#233140', ink: '#eef3f8', ink2: '#b5c3d1', muted: '#7f93a7',
  accent: '#f2c14e', accentInk: '#1a1405', ok: '#4cd38a', warn: '#ffb35c', danger: '#ff6b6b', info: '#5aa9ff'
};

export function Screen({ title, sub, children, footer, onBack, scroll = true }: { title?: string; sub?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void; scroll?: boolean }) {
  const ins = useSafeAreaInsets();
  const head = (title || onBack) ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: sub ? 4 : 14 }}>
      {onBack ? <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Wstecz" style={s.back}><Text style={s.backT}>‹</Text></Pressable> : null}
      {title ? <Text style={s.h1} accessibilityRole="header">{title}</Text> : null}
    </View>
  ) : null;
  const body = (
    <>
      {head}
      {sub ? <Text style={[s.p, { color: C.muted, marginBottom: 16 }]}>{sub}</Text> : null}
      {children}
    </>
  );
  return (
    <View style={{ flex: 1, paddingTop: ins.top + 8 }}>
      {scroll ? <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : <View style={{ flex: 1, padding: 20 }}>{body}</View>}
      {footer ? <View style={[s.footer, { paddingBottom: Math.max(ins.bottom, 12) + 4 }]}>{footer}</View> : null}
    </View>
  );
}

export function Btn({ label, onPress, kind = 'main', disabled, busy, style }: { label: string; onPress: () => void; kind?: 'main' | 'ghost' | 'danger' | 'soft'; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const k = kind === 'main' ? s.btnMain : kind === 'danger' ? s.btnDanger : kind === 'soft' ? s.btnSoft : s.btnGhost;
  const tc = kind === 'main' ? C.accentInk : kind === 'danger' ? C.danger : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || busy) }}
      style={({ pressed }) => [s.btn, k, (disabled || busy) && { opacity: 0.4 }, pressed && { opacity: 0.75 }, style]}>
      {busy ? <ActivityIndicator color={tc} /> : <Text style={[s.btnT, { color: tc }]}>{label}</Text>}
    </Pressable>
  );
}

export const P = ({ children, muted, center }: { children: ReactNode; muted?: boolean; center?: boolean }) =>
  <Text style={[s.p, muted && { color: C.muted }, center && { textAlign: 'center' }]}>{children}</Text>;

export function Note({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'info' | 'danger' | 'ok' }) {
  const col = tone === 'info' ? C.info : tone === 'danger' ? C.danger : tone === 'ok' ? C.ok : C.warn;
  return <View style={[s.note, { borderColor: col }]}><Text style={[s.noteT, { color: col }]}>{children}</Text></View>;
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;

export function Steps({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? C.accent : C.line }} />)}
      </View>
      <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>Krok {step} z {total} · {label}</Text>
    </View>
  );
}

export function CoinIcon({ symbol, color, size = 42 }: { symbol: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33', borderWidth: 1, borderColor: color + '88', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontWeight: '900', fontSize: size * (symbol.length > 3 ? 0.26 : 0.32) }}>{symbol}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { label: string; right?: ReactNode; error?: string | null }) {
  const { label, right, error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.field, error ? { borderColor: C.danger } : null]}>
        <TextInput placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} spellCheck={false} importantForAutofill="no" style={[s.input, style]} {...rest} />
        {right}
      </View>
      {error ? <Text style={{ color: C.danger, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]} accessibilityRole="button"><Text style={s.chipT}>{label}</Text></Pressable>;
}

export function KV({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={[s.kvV, mono && { fontFamily: 'monospace', fontSize: 13 }, strong && { fontSize: 18, fontWeight: '900' }]} selectable>{v}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  h1: { color: C.ink, fontSize: 28, fontWeight: '900', flexShrink: 1 },
  p: { color: C.ink2, fontSize: 16, lineHeight: 23, marginBottom: 12 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, marginRight: 4 },
  backT: { color: C.ink, fontSize: 28, lineHeight: 30, marginTop: -3 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg, gap: 10 },
  btn: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnMain: { backgroundColor: C.accent },
  btnGhost: { borderWidth: 1, borderColor: C.line },
  btnSoft: { backgroundColor: C.card2 },
  btnDanger: { borderWidth: 1, borderColor: C.danger },
  btnT: { fontSize: 17, fontWeight: '800' },
  note: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  noteT: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  label: { color: C.ink2, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingRight: 6 },
  input: { flex: 1, color: C.ink, fontSize: 17, paddingHorizontal: 14, paddingVertical: 14, minHeight: 52 },
  chip: { backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipT: { color: C.accent, fontWeight: '800', fontSize: 14 },
  kv: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  kvK: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  kvV: { color: C.ink, fontSize: 16, fontWeight: '700' }
});
