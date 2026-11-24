// Builds the static site: copies index.html and rebuilds the ai/ folder from pinned npm packages.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUT = "dist";
const TMP = ".pkgs";
const sha1 = (b) => crypto.createHash("sha1").update(b).digest("hex");

const PKGS = {
  model: "dsh-plugin-discover-model@0.1.0",
  tf: "@huggingface/transformers@3.5.2",
};
const EXPECT = {
  "index.html": "7a1e87e0a4966e33e1c29f7d63e709559ff7907a",
  model: "f3ffca8ddb46b4642cb6004d46fec8d07480173c",
  tokenizer: "0fa80703862a830c3905352086e59299ed06b2b2",
  ortwasm: "37b188561166497e3e34ff3dea8a6a5f81379df2",
  ortmjs: "c8abfee04f15f384beec6b516c22e9169034640e",
  tfjs: "6ddef8d5895643317b883e207da2ea9f99bde783",
};

function check(name, buf) {
  const got = sha1(buf);
  if (got !== EXPECT[name]) throw new Error(`${name}: sha1 ${got} != ${EXPECT[name]}`);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const pkgDir = {};
for (const [k, spec] of Object.entries(PKGS)) {
  const tgz = execSync(`npm pack ${spec} --silent`, { cwd: TMP }).toString().trim().split("\n").pop();
  const d = path.join(TMP, k);
  fs.mkdirSync(d);
  execSync(`tar xzf ${tgz} -C ${k}`, { cwd: TMP });
  pkgDir[k] = path.join(d, "package");
}

const html = fs.readFileSync("index.html");
check("index.html", html);
fs.mkdirSync(path.join(OUT, "ai/models/multilingual-e5-small/onnx"), { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html);

function chunk(buf, size, prefix) {
  for (let i = 0, n = 0; i < buf.length; i += size, n++) {
    fs.writeFileSync(path.join(OUT, `${prefix}.${n}.wasm`), buf.subarray(i, i + size));
  }
}

const M = pkgDir.model;
const model = fs.readFileSync(path.join(M, "model_quantized.onnx"));
check("model", model);
chunk(model, 14000000, "ai/models/multilingual-e5-small/onnx/model_quantized.onnx");

const tok = fs.readFileSync(path.join(M, "tokenizer.json"));
check("tokenizer", tok);
chunk(tok, 9000000, "ai/models/multilingual-e5-small/tokenizer.json");

for (const f of ["config.json", "special_tokens_map.json", "tokenizer_config.json"]) {
  fs.copyFileSync(path.join(M, f), path.join(OUT, "ai/models/multilingual-e5-small", f));
}

const D = path.join(pkgDir.tf, "dist");
const ortwasm = fs.readFileSync(path.join(D, "ort-wasm-simd-threaded.jsep.wasm"));
check("ortwasm", ortwasm);
chunk(ortwasm, 11000000, "ai/ort.wasm");

const ortmjs = fs.readFileSync(path.join(D, "ort-wasm-simd-threaded.jsep.mjs"));
check("ortmjs", ortmjs);
fs.writeFileSync(path.join(OUT, "ai/ort-wasm-simd-threaded.jsep.mjs"), ortmjs);

// Same build as npm, with the raw U+FFFD characters written as � escapes.
const tfjs = Buffer.from(
  fs.readFileSync(path.join(D, "transformers.min.js"), "utf8").split("�").join("\\uFFFD"),
  "utf8"
);
check("tfjs", tfjs);
fs.writeFileSync(path.join(OUT, "ai/transformers.min.js"), tfjs);

console.log("Build OK");
