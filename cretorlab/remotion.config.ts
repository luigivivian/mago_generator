import { Config } from "@remotion/cli/config";
import path from "path";

// __dirname resolves to @remotion/cli/dist/ at runtime, not project root.
// Use process.cwd() which is the memelab/ directory.
const srcDir = path.resolve(process.cwd(), "src");

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias ?? {}),
        "@/lib": path.join(srcDir, "lib"),
        "@/stores": path.join(srcDir, "stores"),
        "@/hooks": path.join(srcDir, "hooks"),
        "@/components": path.join(srcDir, "components"),
      },
    },
  };
});
