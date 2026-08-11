const express = require('express');
const mysql = require('mysql2/promise'); // Nuevo driver para MariaDB
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURACIÓN DE CONEXIÓN A MARIADB
// ==========================================
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Cambia esto si tu usuario en DBeaver/MariaDB es distinto
    password: 'a-32001919', // Pon la contraseña de tu base de datos local
    database: 'KartingDB', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==========================================
// ENDPOINTS DEL TABLERO PRINCIPAL
// ==========================================
app.get('/api/tablero', async (req, res) => {
    try {
        const [checkCarrera] = await pool.query(`
            SELECT Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC LIMIT 1
        `);

        if (checkCarrera.length > 0) {                       
            // Modo Carrera (Traducción de T-SQL a MariaDB)
            const [result] = await pool.query(`
                WITH CarreraActiva AS (
                    SELECT Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC LIMIT 1
                ),
                UltimosPilotos AS (
                    SELECT Id, alias FROM Clientes ORDER BY Id DESC LIMIT 6
                ),
                CTE_UltimaVuelta AS (
                    SELECT ClienteId, CarritoId, TiempoVuelta AS ultima_vuelta,
                        ROW_NUMBER() OVER(PARTITION BY ClienteId ORDER BY NumeroVuelta DESC) as fila
                    FROM Vueltas WHERE CarreraId = (SELECT Id FROM CarreraActiva)
                )
                SELECT 
                    IFNULL(c.alias, 'Piloto') AS nombre_piloto,
                    COUNT(v.Id) AS vueltas_completadas,
                    IFNULL(CAST(uv.CarritoId AS CHAR), '-') AS numero_kart,
                    IFNULL(uv.ultima_vuelta, '00:00.000') AS ultima_vuelta,
                    IFNULL(MIN(v.TiempoVuelta), '00:00.000') AS mejor_vuelta
                FROM UltimosPilotos c
                LEFT JOIN Vueltas v ON c.Id = v.ClienteId AND v.CarreraId = (SELECT Id FROM CarreraActiva)
                LEFT JOIN CTE_UltimaVuelta uv ON c.Id = uv.ClienteId AND uv.fila = 1
                GROUP BY c.alias, uv.ultima_vuelta, uv.CarritoId, c.Id
                ORDER BY 
                    CASE WHEN MIN(v.TiempoVuelta) IS NULL THEN 1 ELSE 0 END ASC,
                    MIN(v.TiempoVuelta) ASC;
            `);
            
            res.json({ status: 'success', modo: 'carrera', data: result });

        } else {            
            // Modo Reposo (Uso de DATE_SUB y LIMIT de MariaDB)
            const [topSemana] = await pool.query(`
                SELECT c.alias AS nombre_piloto, MIN(v.TiempoVuelta) AS mejor_vuelta
                FROM Vueltas v
                INNER JOIN Clientes c ON v.ClienteId = c.Id
                WHERE v.FechaRegistro >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY c.alias
                ORDER BY mejor_vuelta ASC LIMIT 3;
            `);

            const [topMes] = await pool.query(`
                SELECT c.alias AS nombre_piloto, MIN(v.TiempoVuelta) AS mejor_vuelta
                FROM Vueltas v
                INNER JOIN Clientes c ON v.ClienteId = c.Id
                WHERE v.FechaRegistro >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY c.alias
                ORDER BY mejor_vuelta ASC LIMIT 3;
            `);

            res.json({ 
                status: 'success', 
                modo: 'reposo', 
                semana: topSemana, 
                mes: topMes 
            });
        }
    } catch (err) {
        console.error("Error Tablero:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

// ==========================================
// NUEVO ENDPOINT: TOP PILOTOS PARA EL CARRUSEL
// ==========================================
app.get('/api/top-pilotos', async (req, res) => {
    try {
        // Busca los 3 mejores tiempos históricos usando tus tablas reales
        const [topPilotos] = await pool.query(`
            SELECT 
                c.alias AS nombre_piloto, 
                c.foto AS foto_url,
                MIN(v.TiempoVuelta) AS mejor_tiempo
            FROM Vueltas v
            INNER JOIN Clientes c ON v.ClienteId = c.Id
            GROUP BY c.Id, c.alias, c.foto
            ORDER BY mejor_tiempo ASC
            LIMIT 3;
        `);

        res.json({ status: 'success', data: topPilotos });
    } catch (err) {
        console.error('Error Top Pilotos:', err);
        res.status(500).json({ status: 'error', mensaje: 'Error interno del servidor' });
    }
});

// ==========================================
// REGISTRO DE CLIENTES
// ==========================================
app.post('/api/registro-paso1', async (req, res) => {
    try {
        const { email, cedula, pasaporte, fechaNacimiento } = req.body;
        let documentoIdentidad = (pasaporte && pasaporte.trim() !== '') ? pasaporte : cedula;
        
        // Uso de placeholders (?) para prevenir SQL Injection en MariaDB
        const [checkDuplicado] = await pool.query(
            `SELECT Id FROM Clientes WHERE Email = ? OR cedula_pasaporte = ?`,
            [email, documentoIdentidad]
        );

        if (checkDuplicado.length > 0) {
            return res.json({ status: 'error', mensaje: 'Este correo electrónico o documento de identidad ya está registrado.' });
        }

        const [result] = await pool.query(
            `INSERT INTO Clientes (Email, FechaRegistro, fecha_nacimiento, cedula_pasaporte) VALUES (?, NOW(), ?, ?)`,
            [email, fechaNacimiento, documentoIdentidad]
        );

        // En MariaDB/MySQL usamos insertId en lugar de OUTPUT INSERTED.Id
        res.json({ status: 'success', clienteId: result.insertId });
        
    } catch (err) {
        console.error("Error Paso 1:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.json({ status: 'error', mensaje: 'Dato duplicado: El correo o documento ya existe.' });
        }
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registro-paso2', async (req, res) => {
    try {
        const { clienteId, nombre, apellido, alias, sexo, pais, telefono } = req.body;
        await pool.query(
            `UPDATE Clientes SET nombre = ?, apellido = ?, alias = ?, sexo = ?, pais = ?, telefono = ? WHERE Id = ?`,
            [nombre, apellido, alias, sexo, pais, telefono, clienteId]
        );
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error Paso 2:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registro-paso3-foto', async (req, res) => {
    try {
        const { clienteId, foto } = req.body; 
        await pool.query(`UPDATE Clientes SET foto = ? WHERE Id = ?`, [foto, clienteId]);
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error Paso 3 (Foto):", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

// ==========================================
// GESTIÓN DE CARRERAS Y VUELTAS
// ==========================================
app.post('/api/iniciar-carrera', async (req, res) => {
    try {
        await pool.query(`UPDATE Carreras SET Estado = 'Finalizada' WHERE Estado = 'En Curso'`);
        await pool.query(`
            INSERT INTO Carreras (NumeroCarreraDiaria, FechaProgramada, HoraInicioReal, Estado)
            VALUES (1, NOW(), NOW(), 'En Curso')
        `);
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error Carrera:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/finalizar-carrera', async (req, res) => {
    try {
        await pool.query(`UPDATE Carreras SET Estado = 'Finalizada' WHERE Estado = 'En Curso'`);
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error finalizando carrera:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

app.post('/api/registrar-vuelta', async (req, res) => {
    try {
        const { clienteId, carritoId, numeroVuelta, tiempoVuelta } = req.body;
        const [carreraQuery] = await pool.query(`SELECT Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC LIMIT 1`);
        
        if (carreraQuery.length === 0) {
            return res.status(400).json({ status: 'error', mensaje: 'No hay carrera En Curso' });
        }
        
        let carreraIdActiva = carreraQuery[0].Id;

        await pool.query(
            `INSERT INTO Vueltas (CarreraId, ClienteId, CarritoId, NumeroVuelta, TiempoVuelta, FechaRegistro) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [carreraIdActiva, clienteId, carritoId, numeroVuelta, tiempoVuelta]
        );

        res.json({ status: 'success' });
    } catch (err) {
        console.error("Error Vueltas:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

// ==========================================
// MONITOR Y DASHBOARD
// ==========================================
app.get('/api/monitor-pits', async (req, res) => {
    try {
        const [salientes] = await pool.query(`
            SELECT DISTINCT c.alias, IFNULL(CAST(v.CarritoId AS CHAR), '-') as kart
            FROM Vueltas v
            INNER JOIN Clientes c ON v.ClienteId = c.Id
            WHERE v.CarreraId = (SELECT Id FROM Carreras WHERE Estado = 'Finalizada' ORDER BY Id DESC LIMIT 1)
        `);
        
        const [en_pista] = await pool.query(`
            SELECT DISTINCT c.alias, IFNULL(CAST(v.CarritoId AS CHAR), '-') as kart
            FROM Vueltas v
            INNER JOIN Clientes c ON v.ClienteId = c.Id
            WHERE v.CarreraId = (SELECT Id FROM Carreras WHERE Estado = 'En Curso' ORDER BY Id DESC LIMIT 1)
        `);
        
        const [proximos] = await pool.query(`SELECT alias, '-' as kart FROM Clientes ORDER BY Id DESC LIMIT 6`);

        res.json({ status: 'success', salientes, en_pista, proximos });
    } catch (err) {
        console.error("Error Monitor Pits:", err);
        res.status(500).json({ status: 'error', mensaje: err.message });
    }
});

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

        const [checkUser] = await pool.query(`SELECT Id FROM Usuarios WHERE Username = ? AND Password = ?`, [username, password]);

        if (checkUser.length > 0) {
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
    console.log(`🚀 Servidor Node.js (MariaDB) corriendo en http://localhost:${PORT}`);
});