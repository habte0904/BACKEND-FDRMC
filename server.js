import express from 'express';
// Trigger nodemon restart
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import sectorRoutes from './routes/sectorRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import rolePermissionRoutes from './routes/rolePermissionRoutes.js';
import hierarchyRoutes from './routes/hierarchyRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import liveDashboardRoutes from './routes/liveDashboardRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import formResponseRoutes from './routes/formResponseRoutes.js';
import woredaProfileRoutes from './routes/woredaProfileRoutes.js';
import { getWoredaProfilesLastUpdated } from './controllers/woredaProfileController.js';
import householdProfileRoutes from './routes/householdProfileRoutes.js';
import woredaAssessmentRoutes from './routes/woredaAssessmentRoutes.js';
import profileMappingRoutes from './routes/profileMappingRoutes.js';
import portalContentRoutes from './routes/portalContentRoutes.js';
import incidentReportRoutes from './routes/incidentReportRoutes.js';
import alertSubscriptionRoutes from './routes/alertSubscriptionRoutes.js';
import emergencyContactRoutes from './routes/emergencyContactRoutes.js';
import inspectionRequestRoutes from './routes/inspectionRequestRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import newsRoutes from './routes/newsRoutes.js';
import adminLogRoutes from './routes/adminLogRoutes.js';
import emailLogRoutes from './routes/emailLogRoutes.js';
import emailConfigRoutes from './routes/emailConfigRoutes.js';
import smsConfigRoutes from './routes/smsConfigRoutes.js';
import smsLogRoutes from './routes/smsLogRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import siteSurveyRoutes from './routes/siteSurveyRoutes.js';
import helpArticleRoutes from './routes/helpArticleRoutes.js';
import reportBuilderRoutes from './routes/reportBuilderRoutes.js';
import { seedDefaultLocations } from './controllers/locationController.js';
import { seedDefaultHelpArticles } from './controllers/helpArticleController.js';
import { seedReportBuilderPermissions } from './controllers/reportBuilderController.js';
import { getActiveSmsConfig } from './services/smppService.js';
import { getActiveEmailConfig } from './services/emailService.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { initSocket } from './services/socketService.js';

dotenv.config();
connectDB().then(() => {
    seedDefaultLocations();
    seedDefaultHelpArticles();
    seedReportBuilderPermissions();
    getActiveSmsConfig();
    getActiveEmailConfig();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// app.use(cors());
// for external access
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
const logFile = fs.createWriteStream('server_logs.txt', { flags: 'a' });



//request logging middleware
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        const logLine = `${new Date().toISOString()} - ${req.method} ${req.originalUrl} - STATUS: ${res.statusCode}\n`;
        console.log(logLine.trim());
        logFile.write(logLine);
        return originalSend.apply(res, arguments);
    };
    next();
});

// Serve static files from uploads directory (both /uploads and /api/uploads for Nginx/reverse proxy compatibility)
const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}
app.use('/uploads', express.static(uploadsDirectory));
app.use('/api/uploads', express.static(uploadsDirectory));

// Lightweight public endpoint (self-contained) returning latest WoredaProfile.updatedAt
app.get('/api/public/gis-last-updated', async (req, res) => {
    try {
        const { default: WoredaProfile } = await import('./models/WoredaProfile.js');
        const latest = await WoredaProfile.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean();
        if (!latest || !latest.updatedAt) return res.json({ lastUpdated: null });
        return res.json({ lastUpdated: latest.updatedAt });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// Public: return recent active incident reports with coordinates for map overlay
app.get('/api/public/active-incidents', async (req, res) => {
    try {
        const { default: IncidentReport } = await import('./models/IncidentReport.js');
        const query = {
            $and: [
                { latitude: { $ne: null } },
                { longitude: { $ne: null } }
            ]
        };
        // Only return active reports if status exists, otherwise return recent with coords
        const docs = await IncidentReport.find(query).sort({ updatedAt: -1 }).limit(200).select('latitude longitude category severity details updatedAt reportCode location').lean();
        res.json(docs);
    } catch (error) {
        console.error('active-incidents error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Public: return woreda profile hazard & vulnerability summaries
app.get('/api/public/woreda-hazards', async (req, res) => {
    try {
        const { default: WoredaProfile } = await import('./models/WoredaProfile.js');
        // Return profiles at woreda aggregation level if available, otherwise top-level profiles
        const query = { $or: [ { 'hierarchy_summary.aggregation_level': 'woreda' }, { aggregation_level: 'woreda' }, { aggregation_level: { $exists: false } } ] };
        const docs = await WoredaProfile.find(query)
            .sort({ 'risk_index.hazard_index': -1, updatedAt: -1 })
            .limit(500)
            .select('location hierarchy_summary risk_index hazards updatedAt')
            .lean();

        const mapped = docs.map(d => ({
            location: d.location || d.hierarchy_summary || {},
            hazardIndex: d.risk_index?.hazard_index ?? null,
            vulnerabilityIndex: d.risk_index?.vulnerability_index ?? null,
            hazards: Array.isArray(d.hazards) ? d.hazards.map(h => h.hazard_name || h) : [],
            updatedAt: d.updatedAt
        }));

        res.json(mapped);
    } catch (error) {
        console.error('woreda-hazards error:', error);
        res.status(500).json({ message: error.message });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/roles', rolePermissionRoutes); // Mounts on /api/roles to support /api/roles/:id/permissions
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/live-dashboard', liveDashboardRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/responses', formResponseRoutes);
// Public quick endpoint for UI to show last GIS update time (register before router mount)
// also expose a clearly public path to avoid router auth interference
app.get('/api/public/woreda-profiles/last-updated', getWoredaProfilesLastUpdated);
app.get('/api/woreda-profiles/last-updated', getWoredaProfilesLastUpdated);
app.use('/api/woreda-profiles', woredaProfileRoutes);
app.use('/api/household-profiles', householdProfileRoutes);
app.use('/api/woreda-assessments', woredaAssessmentRoutes);
app.use('/api/profile-mappings', profileMappingRoutes);
app.use('/api/site-settings', portalContentRoutes);
app.use('/api/incident-reports', incidentReportRoutes);
app.use('/api/alert-subscriptions', alertSubscriptionRoutes);
app.use('/api/emergency-contacts', emergencyContactRoutes);
app.use('/api/inspection-requests', inspectionRequestRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/report-builder', reportBuilderRoutes);
app.use('/api/admin/news', newsRoutes);
app.use('/api/admin-logs', adminLogRoutes);
app.use('/api/email-logs', emailLogRoutes);
app.use('/api/sms-config', smsConfigRoutes);
app.use('/api/sms-logs', smsLogRoutes);
app.use('/api/email-config', emailConfigRoutes);
app.use('/api/site-survey', siteSurveyRoutes);
app.use('/api/help', helpArticleRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Debug: list registered routes (temporary)
app.get('/api/debug/routes', (req, res) => {
    try {
        const routes = [];
        app._router.stack.forEach((middleware) => {
            if (middleware.route) {
                // routes registered directly on the app
                const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
                routes.push({ path: middleware.route.path, methods });
            } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
                middleware.handle.stack.forEach((handler) => {
                    if (handler.route) {
                        const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
                        routes.push({ path: handler.route.path, methods });
                    }
                });
            }
        });
        res.json(routes.sort((a,b)=>a.path.localeCompare(b.path)));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Diagnostic for FormResponse model
// import FormResponse from './models/FormResponse.js';
// console.log("FormResponse Schema Keys:", Object.keys(FormResponse.schema.paths));
// if (FormResponse.schema.paths.moduleContextType.enumValues) {
//     console.log("WARNING: moduleContextType still has enums:", FormResponse.schema.paths.moduleContextType.enumValues);
// } else {
//     console.log("SUCCESS: moduleContextType enum has been removed.");
// }

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (Express + Socket.IO)`);
});





