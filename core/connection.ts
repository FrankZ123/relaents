import { Transaction } from "./transaction";
import { ConnectionManager } from "./connectionmanager";
import { TransactionFactory } from "./transactionfactory";
/**
 * 数据库连接类
 */
class Connection {
    /**
     * 真实连接对象
     */
    conn: any;

    /**
     * 线程id
     */
    threadId: number;

    /**
     * 连接状态
     */
    connected: boolean;

    /**
     * 自动提交
     */
    autoCommit: boolean;

    /**
     * 创建者对象id
     */
    fromId: number;

    /**
     * 事务对象
     */
    transaction: Transaction;

    /**
     * 使用次数
     * @since 0.3.0
     */
    useCount: number;

    /**
     * 构造器
     * @param conn  实际的连接
     */
    constructor(conn?: any) {
        this.useCount = 1;
        this.setConn(conn);
    }

    /**
     * 设置实际的connection
     * @param conn      实际的连接
     * @sinace 0.3.0
     */
    public setConn(conn: any): void {
        if (!conn) {
            return;
        }
        this.conn = conn;
        this.connected = true;
    }

    /**
     * 关闭连接
     * @param force     是否强制关闭
     */
    public async close(force?: boolean): Promise<void> {
        await ConnectionManager.closeConnection(this, force);
    }

    /**
     * 创建事务对象
     */
    public createTransaction(): Transaction {
        let trClass = TransactionFactory.get();
        let con = this.conn;
        return trClass ? Reflect.construct(trClass, [this]) : null;
    }
}

export { Connection }