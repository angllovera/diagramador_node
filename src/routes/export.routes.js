// src/routes/export.routes.js
const { Router } = require("express");
const { create } = require("xmlbuilder2");

const router = Router();

router.post("/xmi", async (req, res) => {
  try {
    // 1) Modelo
    let model = req.body?.model;
    if (typeof model === "string") {
      try { model = JSON.parse(model); } catch {}
    }
    if (!model || typeof model !== "object") {
      return res.status(400).json({ error: "model requerido" });
    }

    const nodes = Array.isArray(model.nodeDataArray) ? model.nodeDataArray : [];
    const links = Array.isArray(model.linkDataArray) ? model.linkDataArray : [];

    // === Helpers ============================================================
    const sanitize = (v) => String(v ?? "").replace(/[^a-zA-Z0-9_]/g, "");
    const idOf = (prefix, key) => `${prefix}_${sanitize(key)}`;
    const nodeKey = (n) => n?.key ?? n?.id ?? n?.name ?? Math.random().toString(36).slice(2);

    const classId = (n) => idOf("cls", nodeKey(n));
    const attrId  = (c, i) => idOf("att", `${nodeKey(c)}_${i}`);
    const opId    = (c, i) => idOf("op",  `${nodeKey(c)}_${i}`);
    const retId   = (c, i) => idOf("ret", `${nodeKey(c)}_${i}`);
    const assocId = (l)    => idOf("assoc", l?.key ?? l?.id ?? `${l?.from}_${l?.to}`);
    const endId   = (l,s)  => idOf("end",  `${l?.key ?? l?.id ?? `${l?.from}_${l?.to}`}_${s}`);
    const genId   = (l)    => idOf("gen",  l?.key ?? l?.id ?? `${l?.from}_${l?.to}`);
    const depId   = (l)    => idOf((l?.category || "dep"), l?.key ?? l?.id ?? `${l?.from}_${l?.to}`);
    const lvId    = (suf)  => idOf("lv", suf);
    const uvId    = (suf)  => idOf("uv", suf);

    const TYPE_MAP = {
      int: "Integer", integer: "Integer", number: "Integer",
      float: "Real", double: "Real",
      string: "String", text: "String", uuid: "String",
      bool: "Boolean", boolean: "Boolean",
      date: "Date", datetime: "DateTime", void: "Void"
    };
    const normalizeTypeName = (t) => TYPE_MAP[String(t || "string").toLowerCase()] || "String";

    // === Documento XMI ======================================================
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("xmi:XMI", {
      "xmi:version": "2.1",
      "xmlns:xmi": "http://schema.omg.org/spec/XMI/2.1",
      "xmlns:uml": "http://www.omg.org/spec/UML/20131001"
    });

    const modelEl = doc.ele("uml:Model", {
      "xmi:id": "model_1",
      name: req.body?.name || "Model"
    });

    const pkg = modelEl.ele("packagedElement", {
      "xmi:type": "uml:Package",
      "xmi:id": "pkg_1",
      name: "Logical View"
    });

    // PrimitiveTypes (útil para EA)
    const primPkg = modelEl.ele("packagedElement", {
      "xmi:type": "uml:Package",
      "xmi:id": "pkg_primitives",
      name: "PrimitiveTypes"
    });
    const PRIMS = ["String", "Integer", "Boolean", "Real", "Date", "DateTime", "Void"];
    const primId = (n) => `prim_${n}`;
    const primIds = {};
    PRIMS.forEach((n) => {
      primPkg.ele("packagedElement", {
        "xmi:type": "uml:PrimitiveType",
        "xmi:id": primId(n),
        name: n
      });
      primIds[n] = primId(n);
    });

    // === Clases =============================================================
    const classIndex = new Map(); // k -> node (para resolver links)
    const classElIdx = new Map(); // k -> xml element (para anidar generalizations)

    nodes
      .filter(n => {
        const cat = String(n?.category ?? "class").toLowerCase();
        return !n.category || ["class","entity","table"].includes(cat);
      })
      .forEach((n) => {
        const k = nodeKey(n);
        n._k = k;
        classIndex.set(k, n);

        const cls = pkg.ele("packagedElement", {
          "xmi:type": "uml:Class",
          "xmi:id": classId(n),
          name: n?.name || `Class_${k}`
        });
        classElIdx.set(k, cls);

        if (n?.abstract) cls.att("isAbstract", "true");

        // atributos (admite string "id: int" o objeto)
        const attrList = n?.attributes || n?.attrs || n?.properties || [];
        attrList.forEach((a, i) => {
          let name = a?.name, type = a?.type, visibility = a?.visibility;
          if (typeof a === "string") {
            const m = a.split(":");
            name = (m[0] || `attr${i + 1}`).trim();
            type = (m[1] || "string").trim();
          }
          const at = cls.ele("ownedAttribute", {
            "xmi:id": attrId(n, i),
            name: name || `attr${i + 1}`,
            visibility: visibility || "private"
          });
          const tName = normalizeTypeName(type);
          at.att("type", primIds[tName] || primIds.String);

          const nullable = !!a?.nullable;
          at.ele("lowerValue", {
            "xmi:type": "uml:LiteralInteger",
            "xmi:id": lvId(`${k}_${i}`),
            value: nullable ? "0" : "1"
          });
          at.ele("upperValue", {
            "xmi:type": "uml:LiteralUnlimitedNatural",
            "xmi:id": uvId(`${k}_${i}`),
            value: "1"
          });
        });

        // operaciones
        (n?.operations || []).forEach((op, i) => {
          const m = cls.ele("ownedOperation", {
            "xmi:id": opId(n, i),
            name: op?.name || `op${i + 1}`,
            visibility: op?.visibility || "public"
          });
          if (op?.type) {
            const tName = normalizeTypeName(op?.type);
            m.ele("ownedParameter", {
              "xmi:id": retId(n, i),
              name: "return",
              direction: "return",
              type: primIds[tName] || primIds.Void
            });
          }
        });
      });

    // === Relaciones =========================================================
    const setMultiplicity = (endEl, multStr, suf) => {
      if (!multStr) return;
      const [loRaw, upRaw] = String(multStr).split("..");
      const lo = (loRaw || "0").replace(/\D/g, "") || "0";
      const up = (upRaw || "1").trim();
      endEl.ele("lowerValue", {
        "xmi:type": "uml:LiteralInteger",
        "xmi:id": lvId(suf),
        value: lo
      });
      endEl.ele("upperValue", {
        "xmi:type": "uml:LiteralUnlimitedNatural",
        "xmi:id": uvId(suf),
        value: up === "*" ? "*" : (up.replace(/\D/g, "") || "1")
      });
    };

    const findNode = (ref) => {
      if (classIndex.has(ref)) return classIndex.get(ref);
      for (const n of classIndex.values()) {
        if (n._k == ref || n.key == ref || n.id == ref || n.name == ref) return n;
      }
      return null;
    };

    links.forEach((l) => {
      const raw = String(l?.category || "association").toLowerCase();
      const cat = raw === "inheritance" ? "generalization" : raw;

      const fromNode = findNode(l?.from);
      const toNode   = findNode(l?.to);
      if (!fromNode || !toNode) return;

      if (cat === "association" || cat === "aggregation" || cat === "composition") {
        // IDs precomputados
        const aId    = assocId(l);
        const endAId = endId(l, "A");
        const endBId = endId(l, "B");

        const assoc = pkg.ele("packagedElement", {
          "xmi:type": "uml:Association",
          "xmi:id": aId,
          name: l?.name || undefined,
          memberEnd: `${endAId} ${endBId}`
        });

        // Extremo A (hacia 'to')
        const endA = assoc.ele("ownedEnd", {
          "xmi:id": endAId,
          type: classId(toNode),
          association: aId,
          ...(l?.toRole ? { name: String(l.toRole) } : {})
        });
        // Extremo B (hacia 'from')
        const endB = assoc.ele("ownedEnd", {
          "xmi:id": endBId,
          type: classId(fromNode),
          association: aId,
          ...(l?.fromRole ? { name: String(l.fromRole) } : {})
        });

        const fromMult = l?.fromMultiplicity ?? l?.multiplicityFrom ?? null;
        const toMult   = l?.toMultiplicity   ?? l?.multiplicityTo   ?? null;
        setMultiplicity(endA, toMult,   `${aId}_A`);
        setMultiplicity(endB, fromMult, `${aId}_B`);

        if (cat === "aggregation") endA.att("aggregation", "shared");
        if (cat === "composition") endA.att("aggregation", "composite");

      } else if (cat === "generalization") {
        // subclase = from, superclase = to
        const subEl = classElIdx.get(fromNode._k);
        if (subEl) {
          subEl.ele("generalization", {
            "xmi:id": genId(l),
            general: classId(toNode)
          });
        } else {
          // fallback (raro que falte)
          pkg.ele("generalization", {
            "xmi:id": genId(l),
            general: classId(toNode)
          });
        }
      } else if (cat === "realization" || cat === "dependency") {
        pkg.ele("packagedElement", {
          "xmi:type": cat === "realization" ? "uml:Realization" : "uml:Dependency",
          "xmi:id": depId(l),
          client: classId(fromNode),
          supplier: classId(toNode),
          name: l?.name || undefined
        });
      }
    });

    const xml = doc.end({ prettyPrint: true });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="diagram_ea.xmi"');
    return res.send(xml);
  } catch (e) {
    console.error("EXPORT_XMI_ERROR", e);
    return res.status(500).json({ error: e.message || "Export error" });
  }
});

module.exports = router;
