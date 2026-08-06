const express = require('express');
const sql = require('mssql');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
    user: 'sa',               
    password: 'Password123',
    server: 'localhost',      
    database: 'KartingDB',
    options: {
        encrypt: false, 
        trustServerCertificate: true
    }
};

app.get('/api/tablero', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);

        let checkCarrera = await pool.request().query(`
            SELECT TOP 1 Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC
        `);

        if (checkCarrera.recordset.length > 0) {                       
            
            let result = await pool.request().query(`
                WITH CarreraActiva AS (
                    SELECT TOP 1 Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC
                ),
                UltimosPilotos AS (
                    SELECT TOP 6 Id, alias FROM Clientes ORDER BY Id DESC
                ),
                CTE_UltimaVuelta AS (
                    SELECT ClienteId, CarritoId, TiempoVuelta AS ultima_vuelta,
                        ROW_NUMBER() OVER(PARTITION BY ClienteId ORDER BY NumeroVuelta DESC) as fila
                    FROM Vueltas WHERE CarreraId = (SELECT Id FROM CarreraActiva)
                )
                SELECT 
                    ISNULL(c.alias, 'Piloto') AS nombre_piloto,
                    COUNT(v.Id) AS vueltas_completadas,
                    ISNULL(CONVERT(varchar, uv.CarritoId), '-') AS numero_kart,
                    ISNULL(RIGHT(CONVERT(varchar, uv.ultima_vuelta, 121), 9), '00:00.000') AS ultima_vuelta,
                    ISNULL(RIGHT(CONVERT(varchar, MIN(v.TiempoVuelta), 121), 9), '00:00.000') AS mejor_vuelta
                FROM UltimosPilotos c
                LEFT JOIN Vueltas v ON c.Id = v.ClienteId AND v.CarreraId = (SELECT Id FROM CarreraActiva)
                LEFT JOIN CTE_UltimaVuelta uv ON c.Id = uv.ClienteId AND uv.fila = 1
                GROUP BY c.alias, uv.ultima_vuelta, uv.CarritoId, c.Id
                ORDER BY 
                    CASE WHEN MIN(v.TiempoVuelta) IS NULL THEN 1 ELSE 0 END ASC,
                    MIN(v.TiempoVuelta) ASC;
            `);
            
            res.json({ status: 'success', modo: 'carrera', data: result.recordset });

        } else {            
        
            let topSemana = await pool.request().query(`
                SELECT TOP 3 
                    c.alias AS nombre_piloto, 
                    RIGHT(CONVERT(varchar, MIN(v.TiempoVuelta), 121), 9) AS mejor_vuelta
                FROM Vueltas v
                INNER JOIN Clientes c ON v.ClienteId = c.Id
                WHERE v.FechaRegistro >= DATEADD(day, -7, GETDATE())
                GROUP BY c.alias
                ORDER BY MIN(v.TiempoVuelta) ASC;
            `);

            
            let topMes = await pool.request().query(`
                SELECT TOP 3 
                    c.alias AS nombre_piloto, 
                    RIGHT(CONVERT(varchar, MIN(v.TiempoVuelta), 121), 9) AS mejor_vuelta
                FROM Vueltas v
                INNER JOIN Clientes c ON v.ClienteId = c.Id
                WHERE v.FechaRegistro >= DATEADD(day, -30, GETDATE())
                GROUP BY c.alias
                ORDER BY MIN(v.TiempoVuelta) ASC;
            `);

            res.json({ 
                status: 'success', 
                modo: 'reposo', 
                semana: topSemana.recordset, 
                mes: topMes.recordset 
            });
        }

    } catch (err) {
        console.error("Error Tablero:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.use(express.json({ limit: '10mb' })); 

app.post('/api/registro-paso1', async (req, res) => {
    try {
        const { email, cedula, pasaporte, fechaNacimiento } = req.body;
        let pool = await sql.connect(dbConfig);
        
        let documentoIdentidad = cedula;
        if (pasaporte && pasaporte.trim() !== '') {
            documentoIdentidad = pasaporte;
        }
        let checkDuplicado = await pool.request()
            .input('email', sql.VarChar, email)
            .input('documento', sql.NVarChar, documentoIdentidad)
            .query(`
                SELECT Id FROM Clientes 
                WHERE Email = @email OR cedula_pasaporte = @documento
            `);
        if (checkDuplicado.recordset.length > 0) {
            return res.json({ 
                status: 'error', 
                mensaje: 'Este correo electrónico o documento de identidad ya está registrado.' 
            });
        }
        let result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('fecha_nacimiento', sql.Date, fechaNacimiento)
            .input('cedula_pasaporte', sql.NVarChar, documentoIdentidad)
            .query(`
                INSERT INTO Clientes 
                (Email, FechaRegistro, fecha_nacimiento, cedula_pasaporte)
                OUTPUT INSERTED.Id
                VALUES 
                (@email, GETDATE(), @fecha_nacimiento, @cedula_pasaporte)
            `);

        res.json({ status: 'success', clienteId: result.recordset[0].Id });
        
    } catch (err) {
        console.error("Error Paso 1:", err);
        if (err.message.includes('UNIQUE KEY constraint')) {
            return res.json({ status: 'error', mensaje: 'Dato duplicado: El correo o documento ya existe.' });
        }
        
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registro-paso2', async (req, res) => {
    try {
        const { clienteId, nombre, apellido, alias, sexo, pais, telefono } = req.body;
        let pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, clienteId)
            .input('nombre', sql.NVarChar, nombre)
            .input('apellido', sql.NVarChar, apellido)
            .input('alias', sql.NVarChar, alias)
            .input('sexo', sql.NVarChar, sexo)
            .input('pais', sql.NVarChar, pais)
            .input('telefono', sql.NVarChar, telefono)
            .query(`
                UPDATE Clientes 
                SET nombre = @nombre, 
                    apellido = @apellido, 
                    alias = @alias, 
                    sexo = @sexo, 
                    pais = @pais, 
                    telefono = @telefono
                WHERE Id = @id
            `);

        res.json({ status: 'success' });
        
    } catch (err) {
        console.error("Error Paso 2:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registro-paso3-foto', async (req, res) => {
    try {
        const { clienteId, foto } = req.body; 
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, clienteId)
            .input('foto', sql.VarChar(sql.MAX), foto)
            .query(`
                UPDATE Clientes 
                SET foto = @foto
                WHERE Id = @id
            `);

        res.json({ status: 'success' });
        
    } catch (err) {
        console.error("Error Paso 3 (Foto):", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/iniciar-carrera', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        
        await pool.request().query(`UPDATE Carreras SET Estado = 'Finalizada' WHERE Estado = 'En Curso'`);
        
        await pool.request().query(`
            INSERT INTO Carreras (NumeroCarreraDiaria, FechaProgramada, HoraInicioReal, Estado)
            VALUES (1, GETDATE(), GETDATE(), 'En Curso')
        `);

        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error Carrera:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/finalizar-carrera', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        
        
        await pool.request().query(`
            UPDATE Carreras 
            SET Estado = 'Finalizada' 
            WHERE Estado = 'En Curso'
        `);

        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error finalizando carrera:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registrar-vuelta', async (req, res) => {
    try {
        const { clienteId, carritoId, numeroVuelta, tiempoVuelta } = req.body;
        let pool = await sql.connect(dbConfig);
        
        let carreraQuery = await pool.request().query(`
            SELECT TOP 1 Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC
        `);
        
        if (carreraQuery.recordset.length === 0) {
            return res.status(400).json({ status: 'error', mensaje: 'No hay carrera En Curso' });
        }
        
        let carreraIdActiva = carreraQuery.recordset[0].Id;

        await pool.request()
            .input('carreraId', sql.Int, carreraIdActiva)
            .input('clienteId', sql.Int, clienteId)
            .input('carritoId', sql.Int, carritoId)
            .input('numeroVuelta', sql.Int, numeroVuelta)
            .input('tiempoVuelta', sql.VarChar, tiempoVuelta) 
            .query(`
                INSERT INTO Vueltas (CarreraId, ClienteId, CarritoId, NumeroVuelta, TiempoVuelta, FechaRegistro) 
                VALUES (@carreraId, @clienteId, @carritoId, @numeroVuelta, @tiempoVuelta, GETDATE())
            `);

        res.json({ status: 'success' });
        
    } catch (err) {
        console.error("Error Vueltas:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.get('/api/monitor-pits', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let salientes = await pool.request().query(`
            SELECT DISTINCT c.alias, ISNULL(CONVERT(varchar, v.CarritoId), '-') as kart
            FROM Vueltas v
            INNER JOIN Clientes c ON v.ClienteId = c.Id
            WHERE v.CarreraId = (
                SELECT TOP 1 Id FROM Carreras WHERE Estado = 'Finalizada' ORDER BY Id DESC
            )
        `);
        let en_pista = await pool.request().query(`
            SELECT DISTINCT c.alias, ISNULL(CONVERT(varchar, v.CarritoId), '-') as kart
            FROM Vueltas v
            INNER JOIN Clientes c ON v.ClienteId = c.Id
            WHERE v.CarreraId = (
                SELECT TOP 1 Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC
            )
        `);
        let proximos = await pool.request().query(`
            SELECT TOP 6 alias, '-' as kart
            FROM Clientes 
            ORDER BY Id DESC
        `);

        res.json({ 
            status: 'success', 
            salientes: salientes.recordset,
            en_pista: en_pista.recordset,
            proximos: proximos.recordset
        });
        
    } catch (err) {
        console.error("Error Monitor Pits:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.use(express.urlencoded({ extended: true }));

app.post('/dashboard', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.send(`
                <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                    <h2 style="color: #dc0000;">Campos vacíos</h2>
                    <p>Debes ingresar usuario y contraseña.</p>
                    <a href="/login.html">Volver</a>
                </div>
            `);
        }

        let pool = await sql.connect(dbConfig);
        
        // 2. Consulta a la base de datos
        let checkUser = await pool.request()
            .input('user', sql.VarChar, username)
            .input('pass', sql.VarChar, password)
            .query(`
                SELECT Id 
                FROM Usuarios 
                WHERE Username = @user AND Password = @pass
            `);

        if (checkUser.recordset.length > 0) {
            res.redirect('/monitor.html');
        } else {
            res.send(`
                <div style="background-color: #1a1a2e; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: 'Montserrat', sans-serif; margin: 0;">
                    <h2 style="color: #e94560;">Acceso Denegado</h2>
                    <p>El usuario o la contraseña son incorrectos.</p>
                    <a href="/login.html" style="margin-top: 20px; padding: 10px 20px; background: #e94560; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Volver a intentar</a>
                </div>
            `);
        }
        
    } catch (err) {
        console.error("Error en Login:", err);
        res.status(500).send("Error interno al conectarse a la base de datos");
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor Node.js corriendo en http://localhost:${PORT}`);
});