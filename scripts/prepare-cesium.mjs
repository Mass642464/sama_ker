import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "node_modules", "cesium", "Build", "Cesium");
const target = join(process.cwd(), "public", "cesium");
mkdirSync(target, { recursive: true });
for (const name of ["Cesium.js", "Assets", "ThirdParty", "Widgets", "Workers"]) {
  cpSync(join(source, name), join(target, name), { recursive: true, force: true });
}
