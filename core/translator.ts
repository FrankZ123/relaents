import {EntityManager} from "./entitymanager";
import { IEntityCfg, IEntityRelation, ERelationType, IEntityColumn } from "./entitydefine";
import { BaseEntity } from "./entity";
import { EntityFactory } from "./entityfactory";
import { ErrorFactory } from "./errorfactory";
import { join } from "path";
import { Entity } from "./decorator/decorator";

/**
 * 翻译器
 */
class Translator{
    /**
     * entity转insert sql
     * @param entity 
     */
    public static entityToInsert(entity:any):string{
        let orm:IEntityCfg = EntityFactory.getClass(entity.constructor.name);
        if(!orm){
            throw ErrorFactory.getError("0010",[entity.constructor.name]);
        }
        let arr:string[] = [];
        arr.push('insert into');
        arr.push(orm.table);
        arr.push('(');
        //字段组合
        let fields:string[] = [];
        //值组合
        let values:string[] = [];
        for(let key of orm.columns){
            let fo:any = key[1];
            let v = entity[key[0]];
            
            //值不存在，则下一个
            if(v === undefined){
                continue;
            }

            //如果绑定字段名不存在，则用属性名
            fields.push(orm.table + '.' + fo.name?fo.name:key);
            
            //值
            if(v !== null && (fo.type === 'date' || fo.type === 'string')){
                values.push("'" + v + "'");
            }else{
                values.push(v);
            }
        }
        arr.push(fields.join(','));
        arr.push(') values (');
        arr.push(values.join(','));
        arr.push(')');
        return arr.join(' ');
    }

    /**
     * entity转update sql
     * @param entity 
     */
    public static entityToUpdate(entity:any):string{
        let orm:IEntityCfg = EntityFactory.getClass(entity.constructor.name);
        if(!orm){
            throw ErrorFactory.getError("0010",[entity.constructor.name]);
        }

        let arr:string[] = [];
        arr.push('update');
        arr.push(orm.table);
        arr.push('set');
        let fv:string[] = [];
        //id值
        let idValue:any;
        //id名
        let idName:string;
        let cfg:IEntityCfg = EntityFactory.getClass(entity.constructor.name);
        if(!cfg.id){
            throw ErrorFactory.getError('0103');
        }
        for(let key of orm.columns){
            let fo:any = key[1];
            //关联对象不处理
            if(fo.refName){
                continue;
            }
            let v = entity[key[0]];
            //如果绑定字段名不存在，则用属性名
            let fn = fo.name?fo.name:key;
            if(v === null || v === undefined){
                if(!fo.nullable){
                    throw ErrorFactory.getError('0021',[key]);
                }
                v = null;
            }else if(fo.type === 'date' || fo.type === 'string'){
                v = "'" + v + "'";
            }
            fv.push(fn + '=' + v);
            if(key[0] === cfg.id.name){
                idValue = v;   
                idName = key[1].name;
            }
        }
        arr.push(fv.join(','));
        //where
        arr.push('where');
        arr.push(idName + '=' + idValue);
        return arr.join(' ');
    }

    /**
     * entity转update sql
     * @param entity    实体对象
     */
    public static entityToDelete(entity:any):string{
        let orm:IEntityCfg = EntityFactory.getClass(entity.constructor.name);
        if(!orm){
            throw ErrorFactory.getError("0010",[entity.constructor.name]);
        }
        if(!orm.id){
            throw ErrorFactory.getError('0102');
        }
        let arr:string[] = [];
        arr.push('delete from');
        arr.push(orm.table);
        arr.push('where');
        //id值
        let idValue:any;
        //id名
        let idName:string;
        if(orm.id){
            idValue = entity[orm.id.name];
            if(idValue === undefined || idValue === null){
                throw ErrorFactory.getError('0102');
            }
            let co:IEntityColumn = orm.columns.get(orm.id.name); 
            idName = co.name;
        }
        
        //字符串
        let field:IEntityColumn = orm.columns.get(orm.id.name);
        if(field.type === 'date' || field.type === 'string'){
            idValue = "'" + idValue + "'";
        }
        arr.push(idName + " = " + idValue);
        return arr.join(' ');
    }

    
    /**
     * 获取sql 字符串
     * @param rql 
     * @returns     {sql:string,map:{aliasName:{entity:对应实体类,from:来源别名,propName:属性名}}}
     */
    public static getQuerySql(rql:string):any{
        //删除多余的空格
        rql = rql.trim().replace(/\s+/g,' ');
        
        let rql1:string = rql.toLowerCase();

        //select 位置
        let indSelect:number = rql1.indexOf('select ')?0:-1;
        // from 位置
        let indFrom:number = rql1.indexOf(' from ');
        // where 位置
        let indWhere:number = rql1.indexOf(' where ');
        // order by 位置
        let indOrderby:number = rql1.indexOf(' order by ');
        
        if(indFrom === -1){
            throw ErrorFactory.getError('0100');
        }

        //表关联数组
        let tableArr:string[];
        //字段关联数组
        let columnArr:string[];
        // where 数组
        let whereArr:string[];
        // order by 数组
        let orderByArr:string[];
        let indTbl:number = indWhere!==-1?indWhere:(indOrderby!==-1?indOrderby:rql.length);

        if(indTbl > indFrom + 1){
            tableArr = rql.substring(indFrom+6,indTbl).trim().split(' ');

            if(indWhere !== -1){
                whereArr = rql.substring(indWhere+7,indOrderby!==-1?indOrderby:rql.length).trim().split(' ');
            }

            if(indOrderby !== -1){
                orderByArr = rql.substring(indOrderby+10,rql.length).trim().split(' ');
            }
        }
        
        columnArr = rql.substring(indSelect+7,indFrom).replace(/\s/g,'').split(',');
        
        //别名索引号
        let aliasIndex:number = 0;

        //别名实体相关map，oldAlias 为rql中定义的别名，newAlias为框架生成的别名，所有oldAlias都需要重新生成
        //索引map {oldAlias:newAlias} 
        let aliasMap:Map<string,string> = new Map();
        // 老别名实体map {oldAlias:entityName}
        let oldAliasEnMap:Map<string,string> = new Map();
        // 老实体别名map {entityName:oldAlias}
        let oldEnAliasMap:Map<string,string> = new Map();
        // 新实体别名map {entityName:newAlias}
        let newEnAliasMap:Map<string,string> = new Map();
        //需要返回的别名对象map
        let retAliasMap:Map<string,object> = new Map();
        // 隐含join main table 的tables{entity:实体名,refEntity:join 右侧实体名,column:column对象}
        let joinTbls:any[] = [];

        // select 字段集合
        // {entityName:[field1,field2]}
        let selectFieldMap:Map<string,boolean> = new Map();

        handleTable(tableArr);
        handleSelectFields(columnArr);
        if(whereArr){
            handleWhere(whereArr);
        }
        if(orderByArr){
            handleOrderby(orderByArr);
        }
        
        let tblStr = EntityFactory.getClass(tableArr[0]).table + ' t0 ';
        //处理主表join
        if(joinTbls.length > 0){
            for(let o of joinTbls){
                let al1:string = newEnAliasMap.get(o.entity);
                let al2:string = newEnAliasMap.get(o.refEntity);
                tblStr += ' left join ' + EntityFactory.getClass(o.refEntity).table + ' ' + al2 + ' on ' + 
                        al1 + '.' + o.column.name + ' = ' + al2 + '.' + o.column.refName;
            }
        }
        tableArr[0] = tblStr;
        //为表添加新别名
        for(let i=1;i<tableArr.length;i++){
            if(newEnAliasMap.has(tableArr[i])){
                tableArr[i] += ' ' + newEnAliasMap.get(tableArr[i]); 
            }
        }

        let sql:string = 'select ' + columnArr.join(',') + ' from ' + tableArr.join(' ');
        if(whereArr){
            sql += ' where ' + whereArr.join(' ');
        }
        if(orderByArr){
            sql += ' order by ' + orderByArr.join(' ');
        }
        return {sql:sql,map:retAliasMap};
        /**
         * 处理表串
         * @param tblArr    表名数组
         */
        function handleTable(arr:string[]){
            //预处理
            //预处理字符
            let preArr:string[] = [',','='];
            for(let i=0;i<arr.length;i++){
                let ch = arr[i];
                for(let pa of preArr){
                    if(ch !== pa && ch.indexOf(pa) !== -1){  
                        handleChar(arr,i,pa);
                        continue;
                    }
                }
            }
            let isEntity:boolean = true;
            let isField:boolean = false;
            for(let i=0;i<arr.length;i++){
                let ch = arr[i];
                let en:string;
                if(ch === ',' || ch === 'join'){
                    isEntity = true;
                    continue;
                }else if(ch === 'on'){  //处理字段 join on field1 = field2
                    isField = true;
                    continue;
                }
                
                if(isEntity){
                    isEntity = false;
                    en = arr[i];
                    let to:IEntityCfg = EntityFactory.getClass(en);
                    if(!to){
                        throw ErrorFactory.getError('0010',[en]);
                    }

                    let alias:string = null;
                    let next:string = arr[i+1];
                    
                    if(next){
                        next = next.toLowerCase();
                        //别名
                        if(![',','left','right','outer','inner'].includes(next)){
                            alias = next;
                            //去掉alias
                            arr.splice(i+1,1);
                        }
                    }
                    //新alias
                    let newAlias:string = 't' + aliasIndex++;
                    newEnAliasMap.set(en,newAlias);
                    //保存alias相关映射
                    if(alias){
                        aliasMap.set(alias,newAlias);
                        oldAliasEnMap.set(alias,en);
                        oldEnAliasMap.set(en,alias);
                        retAliasMap.set(newAlias,{
                            entity:en
                        });
                    }
                }else if(isField){ //
                    isField = false;
                    arr[i] = handleField(arr[i],3);
                    if(arr[i+1] !== '=' || i+2>=arr.length){
                        throw ErrorFactory.getError('0101');
                    }
                    arr[i+2] = handleField(arr[i+2],3);
                    i+=2;
                }
            }
        }

        /**
         * 处理分割字符
         * @param arr       原数组
         * @param index     对应索引号
         * @param char      字符     
         */
        function handleChar(arr:string[],index:number,char:string){
            let a:string[] = arr[index].split(char);
            let a1 = [];

            if(arr[index].startsWith(char)){
                a1.push(char);
            }
            for(let i=0;i<a.length;i++){
                if(a[i] !== ''){
                    a1.push(a[i]);
                    a1.push(char);
                }
            }
            //去除最后一个 char
            if(!arr[index].endsWith(char)){
                a1.pop();
            }
            //替换原数组
            a1.unshift(1);
            a1.unshift(index);
            arr.splice.apply(arr,a1);
        }

        /**
         * 处理select字段集合
         * @param arr   字段集合
         */
        function handleSelectFields(arr:string[]){
            for(let i=0;i<arr.length;i++){
                let fn:string = arr[i];
                let ind1:number = fn.indexOf('(');
                if(ind1 !== -1){ //函数内
                    let foo:string = fn.substr(0,ind1).toLowerCase();
                    fn = fn.substring(ind1+1,fn.length-1);
                    arr[i] = foo + '(' + handleField(fn,2) + ')';
                }else{ //普通字段
                    let cn:string = handleField(fn,1,true);
                    //单字段已在选择集中，不需要
                    if(cn.indexOf(',') === -1 && selectFieldMap.has(cn)){
                        arr.splice(i--,1);
                    }else{ //加入选择集
                        arr[i] = cn;
                        selectFieldMap.set(cn,true);
                    }
                }
            }
        }

        /**
         * 处理where 条件
         */
        function handleWhere(arr:string[]){
            let preArr:string[] = [',','=','>','<','>=','<=','is null','is not null','+','-','*','/','(',')'];
            for(let i=0;i<arr.length;i++){
                let ch = arr[i];
                for(let pa of preArr){
                    if(ch !== pa && ch.indexOf(pa) !== -1){  
                        handleChar(arr,i,pa);
                        continue;
                    }
                }
            }
            let fieldReg:RegExp = /^\w[\w\d]*\./
            for(let i=0;i<arr.length;i++){
                if(!fieldReg.test(arr[i])){
                    continue;
                }
                arr[i] = handleField(arr[i],2);
            }
        }

        /**
         * 处理where 条件
         */
        function handleOrderby(arr:string[]){
            let preArr:string[] = ['(',')'];
            for(let i=0;i<arr.length;i++){
                let ch = arr[i];
                for(let pa of preArr){
                    if(ch !== pa && ch.indexOf(pa) !== -1){  
                        handleChar(arr,i,pa);
                        continue;
                    }
                }
            }
            let fieldReg:RegExp = /^\w[\w\d]*\./
            for(let i=0;i<arr.length;i++){
                if(!fieldReg.test(arr[i])){
                    continue;
                }
                arr[i] = handleField(arr[i],3);
            }
        }

        /**
         * 处理字段
         * @param fieldStr          字段串 
         * @param entityStrategy    实体策略 如果字段最终为实体类型，采集的转化策略，1:获取实体所有属性 2:到最后entity id 3:到上一级entity id(作为条件时)
         * @param useAs             返回该字段是否需要 as 
         */
        function handleField(fieldStr:string,entityStrategy?:number,useAs?:boolean):string{
            //如a.area.areaId
            let fa:string[] = fieldStr.split('.');
            let tblObj:IEntityCfg;

            let alias:string = aliasMap.get(fa[0]);
            // 引用字段（带alias）
            let refName:string;
            //通过别名获取实体名
            let entityName:string = oldAliasEnMap.get(fa[0]);
            if(!entityName){
                throw ErrorFactory.getError('0011',[fa[0]]);
            }
            tblObj = EntityFactory.getClass(entityName);
            if(!tblObj){
                throw ErrorFactory.getError('0010',[entityName]);
            }

            for(let i=1;i<fa.length;i++){
                let co:IEntityColumn = tblObj.columns.get(fa[i]);
                if(!co){
                    throw ErrorFactory.getError('0022',[entityName,fa[i]]);
                }
                if(co.refName){  //外键
                    let rel = tblObj.relations.get(fa[i]);
                    refName = alias + '.' + co.refName;
                    if(rel){
                        //实体尚未存在table map中
                        if(!oldEnAliasMap.has(rel.entity)){
                            let al:string = 't' + aliasIndex++;
                            oldEnAliasMap.set(rel.entity,al);
                            oldAliasEnMap.set(al,rel.entity);
                            newEnAliasMap.set(rel.entity,al);
                            //加入主表 join 
                            joinTbls.push({
                                entity:entityName,
                                refEntity:rel.entity,
                                column:co
                            });

                            //加入返回alias map
                            retAliasMap.set(al,{
                                entity:rel.entity,
                                from:alias,
                                propName:fa[i]
                            });
                        }
                        
                        entityName = rel.entity;
                        tblObj = EntityFactory.getClass(entityName);
                        alias = newEnAliasMap.get(rel.entity);
                        if(!tblObj){
                            throw ErrorFactory.getError('0010',[entityName]);
                        }
                    }
                }else{ //普通字段
                    let f:string = alias + '.' + co.name;
                    if(useAs){
                        f += ' as ' + alias + '_' + fa[i];
                    }
                    return f;
                }
            }
            //最终定位到实体或关联实体
            switch(entityStrategy){
                case 1://获取整个entity 属性及关联属性
                    let fa1 = [];
                    getEntityField(entityName,fa1);
                    return fa1.join(',');    
                case 2://定位到entity id
                    if(tblObj.id){
                        let co:IEntityColumn = tblObj.columns.get(tblObj.id.name);
                        return alias + '.' + co.name;
                    }
                    break;
                case 3: //定位到前一个实体或主实体的id
                    if(refName){
                        return refName;
                    }else if(tblObj.id){
                        let co:IEntityColumn = tblObj.columns.get(tblObj.id.name);
                        return alias + '.' + co.name;
                    
                    }
                    break;
            }
        }

        /**
         * 获取实体字段（含eager=true的关联实体）
         * @param entityName    实体名
         * @param fieldArr      操作的字段数组
         */
        function getEntityField(entityName:string,fieldArr:string[]){
            let to:IEntityCfg = EntityFactory.getClass(entityName);
            if(!to){
                throw ErrorFactory.getError('0010',[entityName]);
            }
            let orm:IEntityCfg = EntityFactory.getClass(entityName);
            if(!orm){
                throw ErrorFactory.getError('0010',[entityName]);
            }
            //旧别名
            for(let fo of orm.columns){
                let alias:string;
                let propName = fo[0];
                let co:IEntityColumn = orm.columns.get(fo[0]);
                if(co.refName){ //处理关联字段
                    let rel:IEntityRelation = orm.relations.get(propName);
                    if(rel.eager){
                        if(!oldEnAliasMap.has(rel.entity)){
                            //生成别名
                            alias = 't' + aliasIndex++;
                            oldAliasEnMap.set(alias,rel.entity);
                            oldEnAliasMap.set(rel.entity,alias);
                            newEnAliasMap.set(rel.entity,alias);
                            joinTbls.push({
                                entity:entityName,
                                refEntity:rel.entity,
                                column:co
                            });

                            //加入返回alias map
                            retAliasMap.set(alias,{
                                entity:rel.entity,
                                from:newEnAliasMap.get(entityName),
                                propName:fo[0]
                            });
                        }
                        
                        getEntityField(rel.entity,fieldArr);
                    }
                }else{
                    let alias:string = newEnAliasMap.get(entityName);
                    //拼接字段
                    let cn:string = alias + '.' + co.name + ' as ' + alias + '_' + fo[0];
                    //如果不存在，则加入选择集
                    if(!selectFieldMap.has(cn)){
                        fieldArr.push(cn);
                        selectFieldMap.set(cn,true);
                    }
                }
            }
        }
    }
}

export {Translator};