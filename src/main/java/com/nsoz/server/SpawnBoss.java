/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package com.nsoz.server;

import com.nsoz.constants.MobName;
import com.nsoz.lib.RandomCollection;
import com.nsoz.map.Map;
import com.nsoz.map.zones.Zone;
import com.nsoz.mob.Mob;
import com.nsoz.mob.MobManager;
import com.nsoz.mob.MobTemplate;
import com.nsoz.util.Log;
import com.nsoz.util.NinjaUtils;
import lombok.Getter;
import lombok.Setter;

/**
 * @author kitakeyos - Hoàng Hữu Dũng
 */
@Setter
@Getter
public class SpawnBoss {

    private final RandomCollection<Integer> mobs = new RandomCollection<>();
    private int id;
    private Map map;
    private Mob currMonster;
    private Mob currMonsterLC1;
    private Mob currMonsterLC2;
    private short x, y;


    public SpawnBoss(int id, Map map, short x, short y) {
        this.id = id;
        this.map = map;
        this.x = x;
        this.y = y;
    }

    public void add(int rate, int mobID) {
        mobs.add(rate, mobID);
    }

    public void spawn() {
        if (currMonster != null) {
            currMonster.die();
            currMonster = null;
        }
        if (map.tilemap.isLangCo()) {
            if (currMonsterLC1 != null) {
                currMonsterLC1.die();
                currMonsterLC1 = null;
            }
            int zoneId = NinjaUtils.nextInt(map.getZones().size());
            Zone z = map.getZoneById(0);
            int mobID = mobs.next();
            MobTemplate mobTemplate = MobManager.getInstance().find(mobID);
            Mob mob = z.getMobFactory().createBoss((short) mobTemplate.getId(), mobTemplate.getHp(), mobTemplate.getLevel(), x, y);
            z.addMob(mob);
            currMonsterLC1 = mob;

            if (currMonsterLC2 != null) {
                currMonsterLC2.die();
                currMonsterLC2 = null;
            }
            Zone z2 = map.getZoneById(1);
            int mobID1 = mobs.next();
            MobTemplate mobTemplate1 = MobManager.getInstance().find(mobID1);
            Mob mob1 = z2.getMobFactory().createBoss((short) mobTemplate1.getId(), mobTemplate1.getHp(), mobTemplate1.getLevel(), x, y);
            z2.addMob(mob1);
            currMonsterLC2 = mob;
            String text = mob.template.name + " đã xuất hiện ở " + z.tilemap.name + " Khu " + zoneId;
            GlobalService.getInstance().chat("server", text);
        } else {
            int zoneId = NinjaUtils.nextInt(map.getZones().size());
            int mobID = mobs.next();
            if (mobID == MobName.CO_HON) {
                zoneId = NinjaUtils.nextOddInt(map.getZones().size());
            }
            Zone z = map.getZoneById(zoneId);
            MobTemplate mobTemplate = MobManager.getInstance().find(mobID);
            Mob mob = z.getMobFactory().createBoss((short) mobTemplate.getId(), mobTemplate.getHp(), mobTemplate.getLevel(), x, y);
            z.addMob(mob);
            currMonster = mob;
            String text = mob.template.name + " đã xuất hiện ở " + z.tilemap.name + " Khu " + zoneId;
            GlobalService.getInstance().chat("server", text);


        }


    }
}
