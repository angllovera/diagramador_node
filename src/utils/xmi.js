// CommonJS
const { create } = require('xmlbuilder2');

function jsonToXMI(modelJson, modelName = 'Modelo') {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('xmi:XMI', {
      'xmlns:xmi': 'http://www.omg.org/XMI',
      'xmlns:uml': 'http://www.eclipse.org/uml2/5.0.0/UML',
      'xmi:version': '2.1'
    });

  const model = doc.ele('uml:Model', { 'xmi:id': 'M1', name: modelName });

  // Clases
  (modelJson?.nodeDataArray || [])
    .filter(n => n.category === 'class')
    .forEach((c, i) => {
      const cid = c.id || `C${i + 1}`;
      const ce = model.ele('packagedElement', {
        'xmi:type': 'uml:Class',
        'xmi:id': cid,
        name: c.name || `Class${i + 1}`
      });
      (c.attributes || []).forEach((a, ai) => {
        ce.ele('ownedAttribute', {
          'xmi:id': `${cid}_A${ai + 1}`,
          name: a.name || `attr${ai + 1}`
        });
      });
    });

  // Relaciones (asociaciones por defecto + herencia)
  (modelJson?.linkDataArray || []).forEach((l, i) => {
    if ((l.category || '').toLowerCase() === 'inheritance') {
      // (En EA la herencia suele ir con generalization dentro de la clase específica;
      // aquí lo dejamos como packagedElement para compatibilidad básica)
      model.ele('packagedElement', {
        'xmi:type': 'uml:Generalization',
        'xmi:id': l.id || `G${i + 1}`,
        specific: l.to,
        general: l.from
      });
      return;
    }

    const aid = l.id || `AS${i + 1}`;
    const assoc = model.ele('packagedElement', {
      'xmi:type': 'uml:Association',
      'xmi:id': aid
    });

    const e1 = assoc.ele('ownedEnd', {
      'xmi:id': `${aid}_e1`,
      type: l.from,
      name: l.fromRole || ''
    });
    addMult(e1, l.multiplicityFrom || '1');

    const e2 = assoc.ele('ownedEnd', {
      'xmi:id': `${aid}_e2`,
      type: l.to,
      name: l.toRole || ''
    });
    addMult(e2, l.multiplicityTo || '1');

    assoc.att('memberEnd', `${aid}_e1 ${aid}_e2`);
  });

  return doc.end({ prettyPrint: true });

  function addMult(end, m = '1') {
    const [lo, hi] = String(m).split('..');
    const lower = isNaN(Number(lo)) ? 0 : Number(lo);
    const upper = (hi ?? lo) === '*' ? '*' : Number(hi ?? lo);
    end.ele('lowerValue', {
      'xmi:type': 'uml:LiteralInteger',
      'xmi:id': `${end.att('xmi:id')}_l`,
      value: lower
    });
    end.ele('upperValue', {
      'xmi:type': 'uml:LiteralUnlimitedNatural',
      'xmi:id': `${end.att('xmi:id')}_u`,
      value: String(upper)
    });
  }
}

module.exports = { jsonToXMI };
