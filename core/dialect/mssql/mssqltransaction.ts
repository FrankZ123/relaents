import { ConnectionManager } from "../../connectionmanager";
import { Logger } from "../../logger";
import { Transaction } from "../../transaction";
import { IsolationLevel } from "../../types";

/**
 * mssql 事务类
 * @since 0.3.0
 */
export class MssqlTransaction extends Transaction {
    /**
     * 实际的transaction
     */
    private tr: any;

    /**
     * 构造器
     * @param conn      connection 
     */
    constructor(conn: any) {
        super(conn);
        //创建实际的transaction
        this.tr = conn.conn.transaction();
    }

    /**
     * 设置当前事务
     * @param isolation 事务隔离级
     * @since           0.4.0
     */
    public async setisolationLevel(isolationLevel: IsolationLevel) {
        if (isolationLevel) {
            let sql = "SET TRANSACTION ISOLATION LEVEL " + isolationLevel;
            await ConnectionManager.provider.exec(this.conn, sql);
            Logger.log(sql);
        }
    }

    /**
     * 开始事务
     */
    async begin() {
        await this.tr.begin();
        super.begin();
    }

    /**
     * 提交事务
     */
    async commit() {
        await this.tr.commit();
        super.commit();
    }

    /**
     * 事务回滚
     */
    async rollback() {
        await this.tr.rollback();
        super.rollback();
    }
}
