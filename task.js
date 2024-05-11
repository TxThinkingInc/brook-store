import _ from './lib/jb'
import { CronJob } from 'cron';

var task = function(db) {
    new CronJob('0 0 * * * *',
        function() {
            var l = db.query(`select * from task`).all()
            for (var i = 0; i < l.length; i++) {
                var v = l[i]
                try {
                    var s = "sshexec"
                    s += ` -s '${v.server}'`
                    s += ` -u '${v.user}'`
                    if (v.password) {
                        s += ` -p '${v.password}'`
                    }
                    if (v.sshkey) {
                        write_file('/tmp/sshkey', v.sshkey)
                        s += ` -k '/tmp/sshkey'`
                    }

                    var s1 = s
                    s1 += ` --download '${v.serverlog_path}'`
                    s1 += ` --to '/tmp/_'`
                    s1 += ` --timeout 600`
                    $(s1)
                    var m = {}
                    var s0 = read_file("/tmp/_").trim()
                    if (!s0) {
                        continue
                    }
                    s0.split("\n").map(v => JSON.parse(v)).forEach(v => {
                        if (v.bytes && v.user) {
                            if (!m[v.user]) m[v.user] = 0
                            m[v.user] += parseInt(v.bytes)
                        }
                    })
                    for (var user in m) {
                        db.query("update user set traffic_now=traffic_now+? where id=?").run(parseInt(m[user] / 1024 / 1024), user)
                    }

                    var s1 = s
                    s1 += ` --download '${v.pid_path}'`
                    s1 += ` --to '/tmp/_'`
                    $(s1)
                    var pid = read_file("/tmp/_")
                    var s1 = s
                    s1 += ` -c 'kill -USR1 ${pid}'`
                    $(s1)
                } catch (e) {
                    echo(e)
                }
            }
        }, null, true, 'utc'
    );
    new CronJob('0 0 0 1 * *',
        function() {
            db.query(`update user set traffic_now=0`).run()
        }, null, true, 'utc'
    );
}

export default task;
