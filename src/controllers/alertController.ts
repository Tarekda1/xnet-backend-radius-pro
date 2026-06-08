import { Request, Response } from 'express';
import { getRepository } from 'typeorm';

// Mock data for development - replace with actual database entities
interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface AlertSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  webhookNotifications: boolean;
  inAppNotifications: boolean;
  emailRecipients: string[];
  smsRecipients: string[];
  webhookUrl?: string;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  escalationPolicy: {
    enabled: boolean;
    escalationDelay: number;
    maxEscalations: number;
  };
}

// Mock data
const mockAlertRules: AlertRule[] = [
  {
    id: '1',
    name: 'High User Load',
    description: 'Alert when active users exceed threshold',
    metric: 'users',
    condition: 'greater_than',
    threshold: 1000,
    duration: 5,
    severity: 'high',
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastTriggered: new Date('2024-01-15T10:30:00'),
    triggerCount: 3
  },
  {
    id: '2',
    name: 'Low Auth Success Rate',
    description: 'Alert when authentication success rate drops',
    metric: 'auth_success_rate',
    condition: 'less_than',
    threshold: 90,
    duration: 10,
    severity: 'critical',
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastTriggered: new Date('2024-01-15T09:15:00'),
    triggerCount: 1
  }
];

const mockAlerts: Alert[] = [
  {
    id: '1',
    ruleId: '1',
    ruleName: 'High User Load',
    severity: 'high',
    message: 'Active users (1,234) exceeded threshold (1,000)',
    metric: 'users',
    value: 1234,
    threshold: 1000,
    timestamp: new Date('2024-01-15T10:30:00'),
    acknowledged: false,
    resolved: false
  },
  {
    id: '2',
    ruleId: '2',
    ruleName: 'Low Auth Success Rate',
    severity: 'critical',
    message: 'Authentication success rate (85%) dropped below threshold (90%)',
    metric: 'auth_success_rate',
    value: 85,
    threshold: 90,
    timestamp: new Date('2024-01-15T09:15:00'),
    acknowledged: true,
    acknowledgedBy: 'admin@example.com',
    acknowledgedAt: new Date('2024-01-15T09:20:00'),
    resolved: true,
    resolvedAt: new Date('2024-01-15T09:45:00')
  }
];

const mockSettings: AlertSettings = {
  emailNotifications: true,
  smsNotifications: false,
  webhookNotifications: true,
  inAppNotifications: true,
  emailRecipients: ['admin@example.com', 'ops@example.com'],
  smsRecipients: ['+1234567890'],
  webhookUrl: 'https://api.example.com/webhooks/alerts',
  quietHours: {
    enabled: true,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC'
  },
  escalationPolicy: {
    enabled: true,
    escalationDelay: 30,
    maxEscalations: 3
  }
};

// Get all alert rules
export const getAlertRules = async (req: Request, res: Response) => {
  try {
    // TODO: Replace with actual database query
    // const alertRules = await getRepository(AlertRule).find();
    
    res.json({
      success: true,
      data: mockAlertRules
    });
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert rules'
    });
  }
};

// Create new alert rule
export const createAlertRule = async (req: Request, res: Response) => {
  try {
    const { name, description, metric, condition, threshold, duration, severity, enabled } = req.body;

    // Validate required fields
    if (!name || !metric || !condition || !threshold || !duration || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const newRule: AlertRule = {
      id: Date.now().toString(),
      name,
      description: description || '',
      metric,
      condition,
      threshold: parseFloat(threshold),
      duration: parseInt(duration),
      severity,
      enabled: enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0
    };

    // TODO: Replace with actual database save
    // const savedRule = await getRepository(AlertRule).save(newRule);
    mockAlertRules.push(newRule);

    res.status(201).json({
      success: true,
      data: newRule
    });
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert rule'
    });
  }
};

// Update alert rule
export const updateAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // TODO: Replace with actual database update
    // const rule = await getRepository(AlertRule).findOne(id);
    const ruleIndex = mockAlertRules.findIndex(r => r.id === id);
    
    if (ruleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Alert rule not found'
      });
    }

    const updatedRule = {
      ...mockAlertRules[ruleIndex],
      ...updates,
      updatedAt: new Date()
    };

    mockAlertRules[ruleIndex] = updatedRule;

    res.json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert rule'
    });
  }
};

// Delete alert rule
export const deleteAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database delete
    // await getRepository(AlertRule).delete(id);
    const ruleIndex = mockAlertRules.findIndex(r => r.id === id);
    
    if (ruleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Alert rule not found'
      });
    }

    mockAlertRules.splice(ruleIndex, 1);

    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete alert rule'
    });
  }
};

// Get all alerts
export const getAlerts = async (req: Request, res: Response) => {
  try {
    // TODO: Replace with actual database query once Alert entity is wired up.
    // Until then, return an empty list — mock alerts from 2024 were shown on every dashboard load.
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts'
    });
  }
};

// Acknowledge alert
export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    // TODO: Replace with actual database update
    // const alert = await getRepository(Alert).findOne(id);
    const alertIndex = mockAlerts.findIndex(a => a.id === id);
    
    if (alertIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    const updatedAlert = {
      ...mockAlerts[alertIndex],
      acknowledged: true,
      acknowledgedBy: acknowledgedBy || 'unknown',
      acknowledgedAt: new Date()
    };

    mockAlerts[alertIndex] = updatedAlert;

    res.json({
      success: true,
      data: updatedAlert
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert'
    });
  }
};

// Resolve alert
export const resolveAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Replace with actual database update
    // const alert = await getRepository(Alert).findOne(id);
    const alertIndex = mockAlerts.findIndex(a => a.id === id);
    
    if (alertIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    const updatedAlert = {
      ...mockAlerts[alertIndex],
      resolved: true,
      resolvedAt: new Date()
    };

    mockAlerts[alertIndex] = updatedAlert;

    res.json({
      success: true,
      data: updatedAlert
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert'
    });
  }
};

// Get alert settings
export const getAlertSettings = async (req: Request, res: Response) => {
  try {
    // TODO: Replace with actual database query
    // const settings = await getRepository(AlertSettings).findOne();
    
    res.json({
      success: true,
      data: mockSettings
    });
  } catch (error) {
    console.error('Error fetching alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert settings'
    });
  }
};

// Update alert settings
export const updateAlertSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // TODO: Replace with actual database update
    // const settings = await getRepository(AlertSettings).findOne();
    // const updatedSettings = await getRepository(AlertSettings).save({
    //   ...settings,
    //   ...updates
    // });

    const updatedSettings = {
      ...mockSettings,
      ...updates
    };

    // Update mock data
    Object.assign(mockSettings, updatedSettings);

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert settings'
    });
  }
};

// Test alert endpoint (for development)
export const testAlert = async (req: Request, res: Response) => {
  try {
    const { severity = 'medium', message = 'Test alert' } = req.body;

    const testAlert: Alert = {
      id: Date.now().toString(),
      ruleId: 'test',
      ruleName: 'Test Alert',
      severity,
      message,
      metric: 'test',
      value: 100,
      threshold: 50,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false
    };

    mockAlerts.unshift(testAlert);

    res.json({
      success: true,
      data: testAlert,
      message: 'Test alert created successfully'
    });
  } catch (error) {
    console.error('Error creating test alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test alert'
    });
  }
}; 