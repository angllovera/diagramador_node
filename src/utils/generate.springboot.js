// src/utils/generate.springboot.js

function generateSpringBootProject(model, { groupId = 'com.example', artifactId = 'app' } = {}) {
  const m = normalizeInput(model);

  if (!m.classes?.length) {
    throw new Error('El modelo no contiene clases válidas (sin nombre/atributos).');
  }

  // ====== HELPERS (function declarations => hoisted) ======
  function idAttrOf(c) { return (c.attributes || []).find(a => a.id); }

  function idType(c) {
    const id = idAttrOf(c);
    const t = (id?.type || '').toLowerCase();
    if (!id) return 'java.lang.Long';
    if (t === 'int' || t === 'integer') return 'java.lang.Integer';
    if (t === 'bigint' || t === 'long' || t === 'number') return 'java.lang.Long';
    return 'java.lang.Long';
  }

  function mapType(t) {
    const type = (t || 'string').toLowerCase();
    switch (type) {
      case 'int':
      case 'integer':  return { name: 'Integer' };
      case 'bigint':
      case 'long':
      case 'number':   return { name: 'Long' };
      case 'float':    return { name: 'Float' };
      case 'double':   return { name: 'Double' };
      case 'decimal':  return { name: 'java.math.BigDecimal', imports: ['java.math.BigDecimal'] };
      case 'bool':
      case 'boolean':  return { name: 'Boolean' };
      case 'date':     return { name: 'java.time.LocalDate', imports: ['java.time.LocalDate'] };
      case 'time':     return { name: 'java.time.LocalTime', imports: ['java.time.LocalTime'] };
      case 'datetime':
      case 'timestamp':return { name: 'java.time.LocalDateTime', imports: ['java.time.LocalDateTime'] };
      case 'uuid':     return { name: 'String' };
      case 'json':     return { name: 'String' };
      default:         return { name: 'String' };
    }
  }

  function plural(s) { return s && s.endsWith('s') ? s : `${s}s`; }
  function snake(s) { return String(s).replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase(); }
  function lcFirst(s) { return (s ? s[0].toLowerCase() + s.slice(1) : s); }
  function cap(s) { return (s ? s[0].toUpperCase() + s.slice(1) : s); }
  function toCamel(s) {
    return String(s || '')
      .replace(/[_\s]+/g,' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\s+/g,'');
  }
  function is1(m) { return /^1$|^0?\.\.?1$/i.test(String(m ?? '').trim()); }
  function isN(m) { return /^(N|\*|0\.\.N|1\.\.N)$/i.test(String(m ?? '').trim()); }
  function paramCase(s) {
    return String(s || '')
      .trim()
      .replace(/[_\s]+/g, '-')
      .replace(/([a-z0-9])([A-Z])/g,'$1-$2')
      .replace(/-+/g,'-')
      .toLowerCase();
  }

  // Inyecta un id si falta
  function ensureId(c) {
    const hasId = (c.attributes || []).some(a => a.id);
    if (!hasId) {
      c.attributes = [
        { name: 'id', type: 'long', id: true, nullable: false, unique: false },
        ...(c.attributes || [])
      ];
    }
    return c;
  }

  // ====== INPUT NORMALIZATION ======
  function normalizeInput(input) {
    if (!input) throw new Error('modelo vacío');

    // Si ya viene normalizado
    if (input.classes && input.relations) {
      input.classes = input.classes
        .map(c => ({ ...c, name: normalizeName(c.name) }))
        .filter(c => c.name && (c.attributes?.length > 0) && !isPlaceholderName(c.name))
        .map(ensureId);
      return input;
    }

    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch { throw new Error('model no es JSON válido'); }
    }

    const nodes = input.nodeDataArray || [];
    const links = input.linkDataArray || [];

    const isClassNode = (n) => {
      const cat = (n.category || '').toLowerCase();
      return cat === 'class' || n.type === 'class' || n.isClass === true || n.kind === 'class' || hasAnyAttributeLike(n);
    };

    const cls = nodes
      .filter(isClassNode)
      .map(n => {
        const name = normalizeName(n.name);
        const attributes = extractAttributesFromNode(n);
        return { name, attributes };
      })
      .filter(c => c.name && (c.attributes?.length > 0) && !isPlaceholderName(c.name))
      .map(ensureId);

    // mapa key->nombre para relaciones (sólo nodos con nombre válido)
    const nameByKey = Object.fromEntries(
      nodes
        .map(n => [n.key, normalizeName(n.name)])
        .filter(([, v]) => v && !isPlaceholderName(v))
    );

    const rels = (links || [])
      .filter(l => l && l.from != null && l.to != null)
      .map(l => ({
        from: nameByKey[l.from],
        to:   nameByKey[l.to],
        kind: 'Associate',
        fromMult: readMult(l, 'from') ?? '1',
        toMult:   readMult(l, 'to')   ?? 'N',
        owner: (l.owner || 'from')
      }))
      .filter(r => r.from && r.to);

    return { classes: cls, relations: rels };
  }

  function normalizeName(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return null;
    const camel = toCamel(txt);
    return camel || null;
  }
  function isPlaceholderName(name) {
    const s = String(name || '').toLowerCase();
    return s === 'clase' || s === 'class';
  }

  function readMult(link, side) {
    const candidates = side === 'from'
      ? ['fromMult','m1','fromMultiplicity','multiplicityFrom','fromText','textFrom','labelFrom']
      : ['toMult','m2','toMultiplicity','multiplicityTo','toText','textTo','labelTo'];
    for (const k of candidates) {
      const v = link[k];
      const m = normalizeMult(v);
      if (m) return m;
    }
    const allStrings = Object.values(link).filter(v => typeof v === 'string');
    for (const s of allStrings) {
      const m = normalizeMult(s);
      if (m) return m;
    }
    return null;
  }
  function normalizeMult(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (/^(1|0..1|0\.\.1)$/i.test(s)) return '1';
    if (/^(\*|N|0..N|1..N|0\.\.N|1\.\.N)$/i.test(s)) return 'N';
    return null;
  }

  // --- atributos ---
  function hasAnyAttributeLike(node) {
    const candidates = [
      'attributes','fields','members','attrs','columns','properties','textAttributes',
      'text','body','content','notes','description','label','value'
    ];
    return candidates.some(k => node[k] != null);
  }

  function extractAttributesFromNode(n) {
    const objArray = firstExisting(n, ['attributes','fields','members','attrs','columns','properties','textAttributes']);
    if (Array.isArray(objArray) && objArray.some(x => x && typeof x === 'object')) {
      return normalizeObjectAttrArray(objArray);
    }
    if (Array.isArray(objArray) && objArray.every(s => typeof s === 'string')) {
      return parseAttributesFromStringLines(objArray);
    }

    const strProps = collectAllStringProps(n);
    if (strProps.length) {
      const afterAttrBlocks = strProps.map(splitAfterAtributos).flat().filter(Boolean);
      const source = afterAttrBlocks.length ? afterAttrBlocks : strProps;
      const parsed = parseAttributesFromStringLines(splitToLines(source.join('\n')));
      if (parsed.length) return parsed;
    }

    return [];
  }

  function firstExisting(obj, keys) { for (const k of keys) if (obj[k] != null) return obj[k]; return null; }

  function normalizeObjectAttrArray(arr) {
    const out = [];
    for (const a of arr) {
      if (a == null || typeof a !== 'object') continue;

      const name = pickFirst(a, ['name','nombre','field','attr','column','key','label']);
      const type = pickFirst(a, ['type','tipo','fieldType','dataType','datatype']);
      const idRaw = pickFirst(a, ['id','isId','primary','pk','isPrimary','primaryKey']);
      const nullableRaw = pickFirst(a, ['nullable','null','isNullable','optional']);
      const requiredRaw = pickFirst(a, ['required','obligatorio']);
      const uniqueRaw = pickFirst(a, ['unique','isUnique','uniq']);

      const normName = String(name ?? '').trim();
      if (!normName) continue;

      let normType = type ?? inferTypeFromSample(a.value);
      normType = normType || 'string';

      const isId = toBool(idRaw) || /^id$/i.test(normName);

      const req = toBool(requiredRaw);
      let nullable = true;
      if (req === true) nullable = false;
      else if (nullableRaw != null) nullable = toBool(nullableRaw);

      const unique = toBool(uniqueRaw);

      out.push({
        name: normName,
        type: String(normType),
        id: !!isId,
        nullable,
        unique
      });
    }
    return out;
  }

  function pickFirst(obj, keys) { for (const k of keys) if (obj[k] != null) return obj[k]; return undefined; }
  function toBool(v) { if (typeof v === 'boolean') return v; if (v == null) return false; const s = String(v).trim().toLowerCase(); return ['1','y','yes','true','t','si','sí'].includes(s); }
  function inferTypeFromSample(v) { if (v == null) return null; if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double'; if (typeof v === 'boolean') return 'boolean'; return 'string'; }

  function collectAllStringProps(n) {
    const strings = [];
    for (const [, v] of Object.entries(n)) {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) {
        v.forEach(it => {
          if (typeof it === 'string') strings.push(it);
          else if (it && typeof it === 'object' && typeof it.text === 'string') strings.push(it.text);
        });
      } else if (v && typeof v === 'object' && typeof v.text === 'string') {
        strings.push(v.text);
      }
    }
    return strings;
  }

  function splitAfterAtributos(s) {
    const m = String(s).match(/atribut[oa]s?/i);
    if (!m) return s;
    return String(s).slice(String(s).indexOf(m[0]) + m[0].length);
  }

  function splitToLines(big) {
    return String(big).split(/\r?\n|,|;|\t/g).map(x => x.trim()).filter(Boolean);
  }

  function parseAttributesFromStringLines(lines) { return lines.flatMap(parseAttributeLine); }

  function parseAttributeLine(line) {
    const t = String(line || '').trim();
    if (!t) return [];
    if (/^(clase|class|campos|propiedades|m[eé]todos|operaciones|atributos)$/i.test(t)) return [];
    if (/^\W*$/i.test(t)) return [];
    const cleaned = t.replace(/^[-+#*\u2022•\u25CF]/, '').trim();

    let m = cleaned.match(/^([A-Za-z_]\w*)\s*:\s*([A-Za-z_][\w<>.]*)/);
    if (!m) m = cleaned.match(/^([A-Za-z_]\w*)\s+([A-Za-z_][\w<>.]*)/);

    if (!m) {
      const only = cleaned.match(/^([A-Za-z_]\w*)$/);
      if (!only) return [];
      const nm = only[1];
      return [{ name: nm, type: 'string', id: /^id$/i.test(nm), nullable: true, unique: false }];
    }
    const name = m[1];
    const type = (m[2] || 'string');
    return [{ name, type, id: /^id$/i.test(name), nullable: true, unique: false }];
  }

  // ====== PATHS ======
  const root = `${artifactId}/`;
  const javaBase = `${root}src/main/java/${groupId.replace(/\./g, '/')}/${artifactId}/`;
  const resBase  = `${root}src/main/resources/`;

  const files = {};
  files[`${root}pom.xml`]                   = pomXml(groupId, artifactId);
  files[`${resBase}application.yml`]        = applicationYml();
  files[`${javaBase}Application.java`]      = applicationClass(groupId, artifactId);

  const pEntity = `${javaBase}domain/entity/`;
  const pRepo   = `${javaBase}domain/repository/`;
  const pSvc    = `${javaBase}service/`;
  const pCtrl   = `${javaBase}web/controller/`;
  const pDto    = `${javaBase}web/dto/`;

  for (const c0 of m.classes) {
    const c = { ...c0, name: toCamel(c0.name) };
    files[`${pEntity}${c.name}.java`]         = entityJava(groupId, artifactId, c, m);
    files[`${pRepo}${c.name}Repository.java`] = repoJava(groupId, artifactId, c);
    files[`${pDto}${c.name}RequestDTO.java`]  = dtoJava(groupId, artifactId, c, 'Request');
    files[`${pDto}${c.name}ResponseDTO.java`] = dtoJava(groupId, artifactId, c, 'Response');
    files[`${pSvc}${c.name}Service.java`]     = serviceJava(groupId, artifactId, c);
    files[`${pCtrl}${c.name}Controller.java`] = controllerJava(groupId, artifactId, c);
  }

  files[`${root}postman/${artifactId}-api.postman_collection.json`] = postmanCollection(artifactId, m);
  files[`${root}http/${artifactId}.http`]                           = httpClientFile(m);

  return files;

  // ----------- templates -----------
  function pomXml(groupId, artifactId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>${artifactId}</name>
  <description>Generated by Diagram-to-SpringBoot</description>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.2</version>
  </parent>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>
    <dependency><groupId>org.springdoc</groupId><artifactId>springdoc-openapi-starter-webmvc-ui</artifactId><version>2.6.0</version></dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin>
    </plugins>
  </build>
</project>
`; }

  function applicationYml() {
    return `spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate.format_sql: true
  h2.console.enabled: true
server.port: 8080
`; }

  function applicationClass(groupId, artifactId) {
    const pkg = `${groupId}.${artifactId}`;
    return `package ${pkg};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
`; }

  function entityJava(groupId, artifactId, c, model) {
    const pkg = `${groupId}.${artifactId}.domain.entity`;
    const imports = new Set(['jakarta.persistence.*', 'lombok.*']);
    const fields = [];

    // Campos escalares
    for (const a of (c.attributes || [])) {
      const mapped = mapType(a.type);
      if (mapped.imports) mapped.imports.forEach(i => imports.add(i));
      const anns = [];
      const tLower = (a.type || '').toLowerCase();

      if (a.id) {
        anns.push('@Id');
        anns.push('@GeneratedValue(strategy = GenerationType.IDENTITY)');
        if (!(tLower === 'int' || tLower === 'integer' || tLower === 'long' || tLower === 'bigint' || tLower === 'number')) {
          a.type = 'long';
        }
      }

      if (a.unique || a.nullable === false) {
        const opts = [ a.unique && 'unique = true', a.nullable === false && 'nullable = false' ].filter(Boolean).join(', ');
        anns.push(`@Column(${opts})`);
      }

      const mappedNow = mapType(a.type);
      if (mappedNow.imports) mappedNow.imports.forEach(i => imports.add(i));

      fields.push(`
  ${anns.join('\n  ')}
  private ${mappedNow.name} ${a.name};`);
    }

    // Relaciones
    const rels = (model.relations || []).filter(r => r.from === c.name || r.to === c.name);
    for (const r of rels) {
      const amIFrom = r.from === c.name;
      const other = amIFrom ? r.to : r.from;
      const mine = amIFrom ? r.fromMult : r.toMult;
      const theirs = amIFrom ? r.toMult : r.fromMult;

      const ownerDeterministic = (lhs, rhs) => lhs.localeCompare(rhs) < 0;
      const ownerToken = (r.owner || '').toLowerCase();
      const ownerIsThisRaw = amIFrom ? ownerToken === 'from' : ownerToken === 'to';
      const ownerIsThis = (isN(mine) && isN(theirs)) || (is1(mine) && is1(theirs))
        ? (ownerToken ? ownerIsThisRaw : ownerDeterministic(c.name, other))
        : null;

      imports.add(`${groupId}.${artifactId}.domain.entity.${other}`);

      if (isN(mine) && is1(theirs)) {
        fields.push(`
  @ManyToOne
  @JoinColumn(name = "${snake(other)}_id")
  private ${other} ${lcFirst(other)};`);
      } else if (is1(mine) && isN(theirs)) {
        fields.push(`
  @OneToMany(mappedBy = "${lcFirst(c.name)}")
  private java.util.List<${other}> ${lcFirst(plural(other))} = new java.util.ArrayList<>();`);
      } else if (isN(mine) && isN(theirs)) {
        fields.push(`
  @ManyToMany${ownerIsThis ? '' : `(mappedBy = "${lcFirst(plural(c.name))}")`}
  ${ownerIsThis ? `@JoinTable(
    name = "${snake(plural(c.name))}_${snake(plural(other))}",
    joinColumns = @JoinColumn(name = "${snake(c.name)}_id"),
    inverseJoinColumns = @JoinColumn(name = "${snake(other)}_id")
  )` : ''}
  private java.util.Set<${other}> ${lcFirst(plural(other))} = new java.util.HashSet<>();`);
      } else if (is1(mine) && is1(theirs)) {
        if (ownerIsThis) {
          fields.push(`
  @OneToOne
  @JoinColumn(name = "${snake(other)}_id", unique = true)
  private ${other} ${lcFirst(other)};`);
        } else {
          fields.push(`
  @OneToOne(mappedBy = "${lcFirst(c.name)}")
  private ${other} ${lcFirst(other)};`);
        }
      }
    }

    const importLines = [...imports].sort().map(i => `import ${i};`).join('\n');
    return `package ${pkg};

${importLines}

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ${c.name} {
  ${fields.join('\n')}
}
`; }

  function repoJava(groupId, artifactId, c) {
    const pkg = `${groupId}.${artifactId}.domain.repository`;
    const entityPkg = `${groupId}.${artifactId}.domain.entity.${c.name}`;
    const idT = idType(c);
    return `package ${pkg};

import org.springframework.data.jpa.repository.JpaRepository;
import ${entityPkg};

public interface ${c.name}Repository extends JpaRepository<${c.name}, ${idT}> {}
`; }

  function dtoJava(groupId, artifactId, c, kind) {
    const pkg = `${groupId}.${artifactId}.web.dto`;
    const imports = new Set(['lombok.Data', 'lombok.NoArgsConstructor']);
    const fields = [];

    for (const a of (c.attributes || [])) {
      if (kind === 'Request' && a.id) continue;
      const mapped = mapType(a.type);
      if (mapped.imports) mapped.imports.forEach(i => imports.add(i));
      fields.push(`  private ${mapped.name} ${a.name};`);
    }

    if (fields.length) imports.add('lombok.AllArgsConstructor');

    const importLines = [...imports].sort().map(i => `import ${i};`).join('\n');
    const lombok = ['@Data','@NoArgsConstructor'].concat(fields.length ? ['@AllArgsConstructor'] : []).join('\n');

    return `package ${pkg};

${importLines}

${lombok}
public class ${c.name}${kind}DTO {
${fields.join('\n')}
}
`; }

  function serviceJava(groupId, artifactId, c) {
    const pkg   = `${groupId}.${artifactId}.service`;
    const entity= `${groupId}.${artifactId}.domain.entity.${c.name}`;
    const repo  = `${groupId}.${artifactId}.domain.repository.${c.name}Repository`;
    const reqDto= `${groupId}.${artifactId}.web.dto.${c.name}RequestDTO`;
    const resDto= `${groupId}.${artifactId}.web.dto.${c.name}ResponseDTO`;
    const idT   = idType(c);

    const setters = (c.attributes || []).filter(a => !a.id)
      .map(a => `    e.set${cap(a.name)}(dto.get${cap(a.name)}());`).join('\n');

    const mapToRes = (c.attributes || [])
      .map(a => `    res.set${cap(a.name)}(e.get${cap(a.name)}());`).join('\n');

    return `package ${pkg};

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;
import ${entity};
import ${repo};
import ${reqDto};
import ${resDto};

@Service
public class ${c.name}Service {
  private final ${c.name}Repository repository;

  @Autowired
  public ${c.name}Service(${c.name}Repository repository) { this.repository = repository; }

  public List<${c.name}ResponseDTO> findAll() {
    return repository.findAll().stream().map(this::toResponse).toList();
  }

  public ${c.name}ResponseDTO findById(${idT} id) {
    var e = repository.findById(id).orElseThrow(() -> new RuntimeException("${c.name} not found"));
    return toResponse(e);
  }

  public ${c.name}ResponseDTO create(${c.name}RequestDTO dto) {
    var e = fromRequest(dto);
    e = repository.save(e);
    return toResponse(e);
  }

  public ${c.name}ResponseDTO update(${idT} id, ${c.name}RequestDTO dto) {
    var e = repository.findById(id).orElseThrow(() -> new RuntimeException("${c.name} not found"));
${setters}
    e = repository.save(e);
    return toResponse(e);
  }

  public void delete(${idT} id) { repository.deleteById(id); }

  private ${c.name}ResponseDTO toResponse(${c.name} e) {
    var res = new ${c.name}ResponseDTO();
${mapToRes}
    return res;
  }

  private ${c.name} fromRequest(${c.name}RequestDTO dto) {
    var e = new ${c.name}();
${setters}
    return e;
  }
}
`; }

  function controllerJava(groupId, artifactId, c) {
    const pkg   = `${groupId}.${artifactId}.web.controller`;
    const svc   = `${groupId}.${artifactId}.service.${c.name}Service`;
    const reqDto= `${groupId}.${artifactId}.web.dto.${c.name}RequestDTO`;
    const resDto= `${groupId}.${artifactId}.web.dto.${c.name}ResponseDTO`;
    const idT   = idType(c);
    const base  = `/api/${paramCase(plural(c.name))}`;

    return `package ${pkg};

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;

import ${svc};
import ${reqDto};
import ${resDto};

@RestController
@RequestMapping("${base}")
public class ${c.name}Controller {
  private final ${c.name}Service service;

  @Autowired
  public ${c.name}Controller(${c.name}Service service) { this.service = service; }

  @GetMapping public List<${c.name}ResponseDTO> list() { return service.findAll(); }
  @GetMapping("/{id}") public ${c.name}ResponseDTO get(@PathVariable ${idT} id) { return service.findById(id); }
  @PostMapping public ${c.name}ResponseDTO create(@RequestBody ${c.name}RequestDTO dto) { return service.create(dto); }
  @PutMapping("/{id}") public ${c.name}ResponseDTO update(@PathVariable ${idT} id, @RequestBody ${c.name}RequestDTO dto) { return service.update(id, dto); }
  @DeleteMapping("/{id}") public void delete(@PathVariable ${idT} id) { service.delete(id); }
}
`; }

  // ============ Postman & HTTP generators ============
  function sampleValue(attr) {
    const t = (attr.type || 'string').toLowerCase();
    if (attr.id) return undefined;
    switch (t) {
      case 'int':
      case 'integer': return 1;
      case 'long':
      case 'bigint':
      case 'number':  return 1;
      case 'float':
      case 'double':  return 1000.0;
      case 'decimal': return 1000.0;
      case 'bool':
      case 'boolean': return true;
      case 'date':     return '2025-01-01';
      case 'time':     return '12:34:56';
      case 'datetime':
      case 'timestamp':return '2025-01-01T12:34:56';
      default:         return attr.name.toLowerCase() === 'email' ? 'demo@example.com' : 'demo';
    }
  }

  function entityRequestBody(cls) {
    const body = {};
    (cls.attributes || []).forEach(a => {
      if (a.id) return;
      body[a.name] = sampleValue(a);
    });
    return body;
  }

  function postmanCollection(artifactId, model) {
    const items = (model.classes || []).map(cls => {
      const base = `/api/${paramCase(plural(cls.name))}`;
      const body = entityRequestBody(cls);
      const namePlural = plural(cls.name);

      function req(name, method, urlSuffix, hasBody = false) {
        const r = {
          name,
          request: {
            method,
            header: [{ key: 'Content-Type', value: 'application/json' }],
            url: { raw: `{{baseUrl}}${base}${urlSuffix}`, host: ['{{baseUrl}}'], path: [base.replace(/^\//,'')].concat(urlSuffix.replace(/^\//,'').split('/').filter(Boolean)) }
          }
        };
        if (hasBody) r.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
        return r;
      }

      return {
        name: namePlural,
        item: [
          req(`Listar ${namePlural}`, 'GET', ''),
          req(`Obtener ${cls.name} por id`, 'GET', '/1'),
          req(`Crear ${cls.name}`, 'POST', '', true),
          req(`Actualizar ${cls.name}`, 'PUT', '/1', true),
          req(`Eliminar ${cls.name}`, 'DELETE', '/1')
        ]
      };
    });

    const collection = {
      info: { _postman_id: '00000000-0000-0000-0000-000000000000', name: `${artifactId}-api`, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: items,
      variable: [{ key: 'baseUrl', value: 'http://localhost:8080' }]
    };
    return JSON.stringify(collection, null, 2);
  }

  function httpClientFile(model) {
    let out = `@baseUrl = http://localhost:8080

`;
    (model.classes || []).forEach(cls => {
      const base = `/api/${paramCase(plural(cls.name))}`;
      const body = entityRequestBody(cls);

      out +=
`### ${cls.name} - Listar
GET {{baseUrl}}${base}

### ${cls.name} - Obtener por id
GET {{baseUrl}}${base}/1

### ${cls.name} - Crear
POST {{baseUrl}}${base}
Content-Type: application/json

${JSON.stringify(body, null, 2)}

### ${cls.name} - Actualizar
PUT {{baseUrl}}${base}/1
Content-Type: application/json

${JSON.stringify(body, null, 2)}

### ${cls.name} - Eliminar
DELETE {{baseUrl}}${base}/1

`;
    });
    return out;
  }
}

module.exports = { generateSpringBootProject };
