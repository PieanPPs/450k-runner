// ตัวเชื่อม binding ของ Cloudflare → interface กลางของแอป (lib/db.js, lib/platform.js)

/** D1 → driver ของ lib/db.js */
export function createD1Driver(d1) {
  const prep = (sql, params) => (params?.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql));
  const info = (r) => ({ changes: r?.meta?.changes ?? 0, lastInsertRowid: r?.meta?.last_row_id });
  return {
    get: async (sql, params) => (await prep(sql, params).first()) ?? undefined,
    all: async (sql, params) => (await prep(sql, params).all()).results,
    run: async (sql, params) => info(await prep(sql, params).run()),
    batch: async (stmts) => (await d1.batch(stmts.map(s => prep(s.sql, s.params)))).map(info),
    exec: async (sql) => { await d1.exec(sql); },
  };
}

/** R2 → ที่เก็บรูป gallery */
export function createR2Files(bucket) {
  return {
    put: (name, bytes, contentType) => bucket.put(name, bytes, { httpMetadata: { contentType } }),
    async get(name) {
      const obj = await bucket.get(name);
      if (!obj) return null;
      return { body: await obj.arrayBuffer(), contentType: obj.httpMetadata?.contentType };
    },
    delete: (name) => bucket.delete(name),
  };
}
