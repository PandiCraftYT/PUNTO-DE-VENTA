import { Stack } from 'expo-router';
import { AuthProvider } from './lib/auth_context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </AuthProvider>
  );
}