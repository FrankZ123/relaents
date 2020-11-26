import { EntityManager } from "./entitymanager";
import { Connection } from "./connection";
import { ThreadStorage } from "./threadlocal";
import { getConnection } from "./connectionmanager";

/**
 * entity manager 工厂
 */
class EntityManagerFactory{
    /**
     * 连接map {threadId:{num:em创建次数,em:entity manager}}
     * 保证一个异步方法中只能有一个entitymanager
     */
    private static entityManagerMap:Map<number,any> = new Map();

    /**
     * 创建 entity manager
     * @param conn  数据库连接对象
     * @returns     entitymanager
     */
    public static async createEntityManager(conn?:Connection){
        if(!conn){
            conn = await getConnection();
        }
        //获取threadId
        let sid:number = ThreadStorage.getStore();
        if(!sid){
            sid = ThreadStorage.newStorage();
        }
        let em:EntityManager;
        if(!this.entityManagerMap.has(sid)){ //
            em = new EntityManager(conn);
            this.entityManagerMap.set(sid,{
                num:1,
                em:em
            });
        }else{
            let o = this.entityManagerMap.get(sid);
            o.num++;
            em = o.em;
        }
        return em;
    }

    /**
     * 关闭entitymanager
     * @param em    entitymanager
     */
    public static closeEntityManager(em:EntityManager){
        //获取threadId
        let sid:number = ThreadStorage.getStore();
        if(!sid || !this.entityManagerMap.has(sid)){
            return;
        }
        let o = this.entityManagerMap.get(sid);
        if(--o.num <= 0){
            this.entityManagerMap.delete(sid);
        }
    }

}

export {EntityManagerFactory};