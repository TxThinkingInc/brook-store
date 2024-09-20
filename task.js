import { CronJob } from 'cron';
import * as fs from 'node:fs/promises';
import { $ } from 'bun';
import lib from './lib/lib.js'

var task = function(db) {
    new CronJob('0 0 * * * *', async function() {
        var l = db.query(`select * from task`).all()
        for (var i = 0; i < l.length; i++) {
            var v = l[i]
            try {
                var password = ''
                if (v.password) {
                    password = `-p '${v.password}'`
                }
                var sshkey = ''
                if (v.sshkey) {
                    await fs.writeFile('/tmp/sshkey', v.sshkey)
                    sshkey = `-k '/tmp/sshkey'`
                }
                await $`sshexec -s '${v.server}' -u '${v.user}' ${password} ${sshkey} --download '${v.serverlog_path}' --to '/tmp/_' --timeout 600`
                var m = {}
                var s = (await fs.readFile("/tmp/_", { encoding: 'utf8' })).trim()
                if (!s) {
                    continue
                }
                s.split("\n").map(v => JSON.parse(v)).forEach(v => {
                    if (v.bytes && v.user) {
                        if (!m[v.user]) m[v.user] = 0
                        m[v.user] += parseInt(v.bytes)
                    }
                })
                for (var user in m) {
                    db.query("update user set traffic_now=traffic_now+? where id=?").run(parseInt(m[user] / 1024 / 1024), user)
                    await lib.setImmediatePromise()
                }

                await $`sshexec -s '${v.server}' -u '${v.user}' ${password} ${sshkey} --download '${v.pid_path}' --to '/tmp/_' --timeout 60`
                var s = (await fs.readFile("/tmp/_", { encoding: 'utf8' })).trim()
                await $`sshexec -s '${v.server}' -u '${v.user}' ${password} ${sshkey} -c 'kill -USR1 ${s}' --timeout 60`
            } catch (e) {
                console.log(e)
            }
        }
    }, null, true, 'utc');
    new CronJob('0 0 0 1 * *', function() {
        db.query(`update user set traffic_now=0`).run()
    }, null, true, 'utc');
}

export default task;
