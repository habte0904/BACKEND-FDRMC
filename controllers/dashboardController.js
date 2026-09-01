import * as dashboardService from '../services/dashboardService.js';

/**
 * Get dashboard statistics based on user's permissions and hierarchy
 * @route GET /api/dashboard/stats
 * @access Protected
 */
export const getStats = async (req, res) => {
    try {
        // req.user is populated by the protect middleware, pass req.query filters
        const stats = await dashboardService.getDashboardStats(req.user, req.query);
        res.json(stats);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: error.message });
    }
};
