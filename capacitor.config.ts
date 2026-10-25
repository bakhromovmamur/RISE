import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.rise.habits",
  appName: "RISE",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_rise",
      iconColor: "#1f7855",
      presentationOptions: ["sound", "banner", "list"],
    },
  },
};
export default config;
