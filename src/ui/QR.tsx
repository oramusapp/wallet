// QR code drawn with plain Views (no extra native module). Error correction M, dark on white with a quiet zone.
import { useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';

export function QR({ value, size = 232 }: { value: string; size?: number }) {
  const rows = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
  }, [value]);
  const n = rows.length, quiet = 4, cell = Math.floor(size / (n + quiet * 2));
  return (
    <View style={{ backgroundColor: '#fff', padding: cell * quiet, borderRadius: 16, alignSelf: 'center' }} accessibilityLabel={'Kod QR adresu ' + value}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((d, c) => <View key={c} style={{ width: cell, height: cell, backgroundColor: d ? '#000' : '#fff' }} />)}
        </View>
      ))}
    </View>
  );
}
