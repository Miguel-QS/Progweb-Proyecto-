# Valida que las consultas SQL de api/lib/*.php solo usen tablas y columnas que existen en database/albummatch.sql.
# (Las prepara contra un esquema SQLite equivalente; no necesita PHP ni MySQL.)  Uso: python3 tests/php_sql_check.py
import re, glob, sqlite3, sys
import os
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
ddl=open(base+'database/albummatch.sql',encoding='utf-8').read()
# --- esquema SQLite: columnas tomadas del DDL de MySQL ---
db=sqlite3.connect(':memory:')
for name,body in re.findall(r'CREATE TABLE (\w+) \((.*?)\n\) ENGINE',ddl,re.S):
    cols=[]
    for line in body.split('\n'):
        line=line.strip()
        m=re.match(r'^(\w+)\s+(TINYINT|SMALLINT|INT|VARCHAR|DATETIME)',line)
        if m and not line.upper().startswith(('PRIMARY','UNIQUE','KEY','CONSTRAINT')): cols.append(m.group(1))
    db.execute('CREATE TABLE %s (%s)'%(name,', '.join(cols)))
for v in re.findall(r'CREATE VIEW .*?;',ddl,re.S):
    db.execute(v)
consts={'CAT_COLS':'id_album, titulo, anio_lanzamiento, portada_hue, id_artista, artista, id_genero, genero, promedio, total_resenas',
        'CAT_COLS_C':'c.id_album, c.titulo, c.anio_lanzamiento, c.portada_hue, c.id_artista, c.artista, c.id_genero, c.genero, c.promedio, c.total_resenas'}
def parse_arg(t,i):
    out=[];n=len(t)
    while i<n:
        while t[i].isspace(): i+=1
        c=t[i]
        if c in "'\"":
            j=i+1;buf=''
            while t[j]!=c:
                if t[j]=='\\' and c=="'" and t[j+1] in "\\'": buf+=t[j+1]; j+=2; continue
                buf+=t[j]; j+=1
            out.append(buf); i=j+1
        elif c=='$':
            m=re.match(r'\$\w+',t[i:]); out.append('5'); i+=m.end()
        elif re.match(r'[A-Z_]',c):
            m=re.match(r'\w+',t[i:]); name=m.group(0)
            if name not in consts: return None,i
            out.append(consts[name]); i+=m.end()
        else: return None,i
        while t[i].isspace(): i+=1
        if t[i]=='.': i+=1; continue
        return ''.join(out),i
    return None,i
sqls=[]
for f in sorted(glob.glob(base+'api/lib/*.php')):
    t=open(f,encoding='utf-8').read()
    for m in re.finditer(r'\b(rows|row|val|q|run)\(\s*',t):
        sql,_=parse_arg(t,m.end())
        if sql and re.match(r'\s*(SELECT|INSERT|UPDATE|DELETE)',sql,re.I): sqls.append((f.split('/')[-1],sql))
print('consultas extraídas:',len(sqls))
bad=0
for f,sql in sqls:
    s=sql.replace('NOW()',"datetime('now')").replace('INSERT IGNORE','INSERT OR IGNORE')
    n=s.count('?')
    try:
        db.execute('EXPLAIN '+s,[1]*n)
    except sqlite3.Error as e:
        bad+=1; print('ERROR en',f,':',e,'\n   ',' '.join(sql.split())[:200])
print('con error:',bad)
