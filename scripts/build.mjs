// ينسخ ملفات اللعبة لمجلد www اللي يستخدمه Capacitor لبناء تطبيق الآيفون
import { rmSync, mkdirSync, cpSync } from "node:fs";
const out = "www";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css", "js", "assets"]) cpSync(f, `${out}/${f}`, { recursive: true });
console.log("✓ الملفات جاهزة في www/");
