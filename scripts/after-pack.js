// Sets the MSK icon + version info on MSK.exe without needing wine/rcedit.
const path = require("path");
const fs = require("fs");
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName === "darwin") {
    // No Apple developer cert: ad-hoc sign so Apple Silicon will run it at all.
    const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + ".app");
    if (process.platform !== "darwin") { console.log("  • skipping ad-hoc signing (not on a Mac)"); return; }
    require("child_process").execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
    console.log("  • ad-hoc signed", path.basename(app));
    return;
  }
  if (ctx.electronPlatformName !== "win32") return;
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + ".exe");
  const ResEdit = await import("resedit");
  const exeObj = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exeObj);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, "..", "build", "icon.ico")));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const g = groups[0] || { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const lang = vi.getAllLanguagesForStringValues()[0] || { lang: 1033, codepage: 1200 };
    vi.setStringValues(lang, { ProductName: "MSK", FileDescription: "MSK", CompanyName: "meeshy", OriginalFilename: "MSK.exe", InternalName: "MSK", LegalCopyright: "meeshy" });
    vi.setFileVersion(1, 0, 0, 0, lang.lang); vi.setProductVersion(1, 0, 0, 0, lang.lang);
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log("  • MSK icon applied to", path.basename(exe));
};
