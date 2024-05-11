var migrate = (sqlite) => {
    var f = (id, sql) => {
        var r = sqlite.query(`select * from migration where id=?`).get(id);
        if (r) {
            return
        }
        sqlite.query(sql).run();
        sqlite.query(`insert into migration(id) values(?)`).run(id);
    };
    var l = sqlite.query(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    if (!l.find(v => v.name == 'migration')) {
        sqlite.query(`
create table migration(
    id text not null UNIQUE
)
`).run();
    }
    return f;
};

export default migrate;
