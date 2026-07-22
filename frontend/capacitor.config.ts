import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sezzle.calculator',
  appName: 'Sezzle Calculator',
  webDir: 'dist',
  ios: {
    // CSS safe-area insets own the layout; native scroll insets would apply it twice.
    contentInset: 'never',
    preferredContentMode: 'mobile',
  },
  plugins: {
    // Keep the backend's exact-origin CORS policy; native fetches use URLSession.
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
