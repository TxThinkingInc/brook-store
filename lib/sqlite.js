var db = (sdb) => {
    return {
        c: (table, o) => {
            var l = [];
            var l1 = [];
            var params = {};
            for (var k in o) {
                if (k == 'id') {
                    continue;
                }
                l.push(k);
                l1.push(`$${k}`);
                params[`$${k}`] = o[k];
            }
            sdb.query(`insert into ${table}(${l.join(', ')}) values(${l1.join(', ')})`).run(params);
            var r = sdb.query(`select seq from sqlite_sequence where name=?`).get(table);
            return sdb.query(`select * from ${table} where id=?`).get(r.seq);
        },
        u: (table, o) => {
            if (!o.id) {
                throw new Error('u needs object has id');
            }
            var l = [];
            var params = {};
            for (var k in o) {
                if (k == 'id') {
                    continue;
                }
                l.push(`${k}=$${k}`);
                params[`$${k}`] = o[k];
            }
            params[`$id`] = o.id;
            sdb.query(`update ${table} set ${l.join(', ')} where id=$id`).run(params);
            return sdb.query(`select * from ${table} where id=?`).get(o.id);
        },
        r: (table, id) => {
            return sdb.query(`select * from ${table} where id=?`).get(id)
        },
        d: (table, id) => {
            sdb.query(`delete from ${table} where id=?`).run(id)
        },
        query: (...args) => {
            return sdb.query(...args);
        },
        transaction: (f) => {
            return sdb.transaction(f)();
        },
        close: () => {
            sdb.close();
        },
    };
};

var Database = require("bun:sqlite").Database;
var sqlite = (path) => {
    var s = new Database(path, { create: true });
    return db(s);
};

export default sqlite;
