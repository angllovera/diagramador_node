// CommonJS
const { create } = require("xmlbuilder2");

/**
 * Convierte un GraphLinksModel (GoJS) a XMI 2.1 compatible con EA.
 * - Crea clases (category: class|entity|table)
 * - Asocia links como Association (o Generalization) con memberEnd y association en los ownedEnd
 * - Soporta multiplicidades from/to
 */
function jsonToXMI(modelJson, modelName = "Modelo") {
  const nodes = Array.isArray(modelJson?.nodeDataArray) ? modelJson.nodeDataArray : [];
  const links = Array.isArray(modelJson?.linkDataArray) ? modelJson.linkDataArray : [];

  // Helpers
  const sanitize = (v) => String(v ?? "").replace(/[^a-zA-Z0-9_]/g, "");
  const idOf = (p, s) => `${p}_${sanitize(s)}`;
  const nodeKey = (n) => n?.key ?? n?.id ?? n?.name ?? Math.random().toString(36).slice(2);

  const classId = (n) => idOf("cls", nodeKey(n));
  const attrId  = (c, i) => idOf("att", `${nodeKey(c)}_${i}`);
  const assocId = (l)    => idOf("assoc", l?.key ?? l?.id ?? `${l?.from}_${l?.to}`);
  const endId   = (l,s)  => idOf("end",  `${l?.key ?? l?.id ?? `${l?.from}_${l?.to}`}_${s}`);
  const genId   = (l)    => idOf("gen",  l?.key ?? l?.id ?? `${l?.from}_${l?.to}`);
  const lvId    = (suf)  => idOf("lv", suf);
  const uvId    = (suf)  => idOf("uv", suf);

  const classIndex = new Map();
  const classElIdx = new Map();

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("xmi:XMI", {
      "xmi:version": "2.1",
      "xmlns:xmi": "http://schema.omg.org/spec/XMI/2.1",
      "xmlns:uml": "http://www.omg.org/spec/UML/20131001"
    });

  const model = doc.ele("uml:Model", { "xmi:id": "M1", name: modelName });

  const pkg = model.ele("packagedElement", {
    "xmi:type": "uml:Package",
    "xmi:id": "PKG1",
    name: "Logical View"
  });

  // Clases
  nodes
    .filter(n => {
      const cat = String(n?.category ?? "class").toLowerCase();
      return !n.category || ["class","entity","table"].includes(cat);
    })
    .forEach((c, i) => {
      const cid = classId(c);
      const ce = pkg.ele("packagedElement", {
        "xmi:type": "uml:Class",
        "xmi:id": cid,
        name: c.name || `Class${i + 1}`
      });
      if (c?.abstract) ce.att("isAbstract", "true");
      classIndex.set(nodeKey(c), c);
      classElIdx.set(nodeKey(c), ce);

      (c.attributes || c.attrs || c.properties || []).forEach((a, ai) => {
        const name = (typeof a === "string" ? a.split(":")[0] : a?.name) || `attr${ai + 1}`;
        ce.ele("ownedAttribute", {
          "xmi:id": attrId(c, ai),
          name
        });
      });
    });

  // Relaciones
  links.forEach((l, i) => {
    const raw = String(l?.category || "association").toLowerCase();
    const cat = raw === "inheritance" ? "generalization" : raw;

    const findNode = (ref) => {
      for (const n of classIndex.keys()) {
        const node = classIndex.get(n);
        if (n == ref || node?.key == ref || node?.id == ref || node?.name == ref) return node;
      }
      return null;
    };

    const fromNode = findNode(l?.from);
    const toNode   = findNode(l?.to);
    if (!fromNode || !toNode) return;

    if (cat === "association" || cat === "aggregation" || cat === "composition") {
      const aid    = assocId(l);
      const endAId = endId(l, "A");
      const endBId = endId(l, "B");

      const assoc = pkg.ele("packagedElement", {
        "xmi:type": "uml:Association",
        "xmi:id": aid,
        memberEnd: `${endAId} ${endBId}`
      });

      const endA = assoc.ele("ownedEnd", {
        "xmi:id": endAId,
        type: classId(toNode),
        association: aid,
        ...(l?.toRole ? { name: String(l.toRole) } : {})
      });
      const endB = assoc.ele("ownedEnd", {
        "xmi:id": endBId,
        type: classId(fromNode),
        association: aid,
        ...(l?.fromRole ? { name: String(l.fromRole) } : {})
      });

      const fromMult = l?.fromMultiplicity ?? l?.multiplicityFrom ?? l?.multiplicity_from ?? "1";
      const toMult   = l?.toMultiplicity   ?? l?.multiplicityTo   ?? l?.multiplicity_to   ?? "1";
      addMult(endA, toMult,   `${aid}_A`);
      addMult(endB, fromMult, `${aid}_B`);

      if (cat === "aggregation") endA.att("aggregation", "shared");
      if (cat === "composition") endA.att("aggregation", "composite");

    } else if (cat === "generalization") {
      const subEl = classElIdx.get(nodeKey(fromNode));
      if (subEl) {
        subEl.ele("generalization", {
          "xmi:id": genId(l),
          general: classId(toNode)
        });
      } else {
        // fallback
        pkg.ele("generalization", {
          "xmi:id": genId(l),
          general: classId(toNode)
        });
      }
    }
  });

  return doc.end({ prettyPrint: true });

  // Multiplicidades
  function addMult(end, m = "1", suf = "") {
    const [lo, hi] = String(m).split("..");
    const loNum = (lo || "1").trim() === "*" ? "0" : (lo || "1").replace(/\D/g, "") || "1";
    const hiRaw = (hi ?? lo ?? "1").trim();
    const hiVal = hiRaw === "*" ? "*" : (hiRaw.replace(/\D/g, "") || "1");

    end.ele("lowerValue", {
      "xmi:type": "uml:LiteralInteger",
      "xmi:id": lvId(`${suf}_l`),
      value: loNum
    });
    end.ele("upperValue", {
      "xmi:type": "uml:LiteralUnlimitedNatural",
      "xmi:id": uvId(`${suf}_u`),
      value: hiVal
    });
  }
}

module.exports = { jsonToXMI };
