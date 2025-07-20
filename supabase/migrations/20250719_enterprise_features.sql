-- Enterprise Features Database Schema
-- Comprehensive enterprise tables for security, compliance, multi-tenancy, and support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Security Events Table
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID,
    source_ip INET,
    user_agent TEXT,
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'blocked')),
    details JSONB DEFAULT '{}',
    threat_score INTEGER DEFAULT 0 CHECK (threat_score >= 0 AND threat_score <= 100),
    compliance_frameworks TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants Table for Multi-tenancy
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    branding JSONB NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    subscription JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource Quotas Table
CREATE TABLE resource_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cpu_limit INTEGER NOT NULL,
    memory_limit INTEGER NOT NULL, -- MB
    storage_limit INTEGER NOT NULL, -- GB
    bandwidth_limit INTEGER NOT NULL, -- GB per month
    api_calls_limit INTEGER NOT NULL, -- calls per hour
    current_usage JSONB DEFAULT '{"cpu": 0, "memory": 0, "storage": 0, "bandwidth": 0, "apiCalls": 0}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Definitions Table
CREATE TABLE sla_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'standard', 'premium', 'enterprise')),
    metrics JSONB NOT NULL DEFAULT '{}',
    penalties JSONB NOT NULL DEFAULT '{}',
    support JSONB NOT NULL DEFAULT '{}',
    reporting JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Measurements Table
CREATE TABLE sla_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    target DECIMAL(10,4) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('met', 'breached', 'at_risk')),
    metadata JSONB DEFAULT '{}'
);

-- Incidents Table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('p1_critical', 'p2_high', 'p3_medium', 'p4_low')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'investigating', 'identified', 'monitoring', 'resolved')),
    affected_services TEXT[] DEFAULT '{}',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    downtime INTEGER, -- minutes
    impacted_users INTEGER,
    root_cause TEXT,
    resolution TEXT,
    sla_impact JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Frameworks Table
CREATE TABLE compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('compliant', 'partial', 'non_compliant')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    requirements JSONB DEFAULT '{}',
    last_assessment TIMESTAMPTZ,
    next_assessment TIMESTAMPTZ,
    certification_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    evidence JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table (Enhanced)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    user_role VARCHAR(100),
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
    source_ip INET,
    user_agent TEXT,
    location VARCHAR(255),
    details JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enterprise Integrations Table
CREATE TABLE enterprise_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive', 'error', 'configuring', 'testing')),
    description TEXT,
    configuration JSONB NOT NULL DEFAULT '{}',
    health_check JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{"totalRequests": 0, "successfulRequests": 0, "failedRequests": 0, "averageResponseTime": 0, "dataTransferred": 0}',
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets Table
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('p1_critical', 'p2_high', 'p3_medium', 'p4_low')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('phone', 'email', 'chat', 'slack', 'teams', 'portal')),
    customer JSONB NOT NULL,
    assignee JSONB,
    sla JSONB NOT NULL,
    timeline JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    satisfaction JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Knowledge Base Articles Table
CREATE TABLE knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(100) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'customer', 'internal')),
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    estimated_read_time INTEGER, -- minutes
    views INTEGER DEFAULT 0,
    helpful INTEGER DEFAULT 0,
    not_helpful INTEGER DEFAULT 0,
    author JSONB NOT NULL,
    last_reviewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Sessions Table (Enhanced)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address INET,
    location VARCHAR(255),
    device_info JSONB DEFAULT '{}',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    security_flags JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enterprise Roles Table
CREATE TABLE enterprise_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Enterprise Permissions Table
CREATE TABLE enterprise_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Role Assignments Table
CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES enterprise_roles(id) ON DELETE CASCADE,
    assigned_by UUID,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, user_id, role_id)
);

-- Vulnerability Scans Table
CREATE TABLE vulnerability_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    scan_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    vulnerabilities JSONB DEFAULT '[]',
    overall_risk VARCHAR(20) CHECK (overall_risk IN ('low', 'medium', 'high', 'critical')),
    recommendations TEXT[],
    metadata JSONB DEFAULT '{}'
);

-- Data Access Logs Table
CREATE TABLE data_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_email VARCHAR(255),
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('select', 'insert', 'update', 'delete')),
    record_count INTEGER DEFAULT 0,
    sensitive_data BOOLEAN DEFAULT false,
    purpose TEXT,
    approved BOOLEAN DEFAULT false,
    approved_by UUID,
    query_hash TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_security_events_tenant_timestamp ON security_events(tenant_id, timestamp DESC);
CREATE INDEX idx_security_events_type_severity ON security_events(type, severity);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_source_ip ON security_events(source_ip);

CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);

CREATE INDEX idx_sla_measurements_tenant_type ON sla_measurements(tenant_id, metric_type);
CREATE INDEX idx_sla_measurements_timestamp ON sla_measurements(timestamp DESC);

CREATE INDEX idx_incidents_tenant_severity ON incidents(tenant_id, severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_start_time ON incidents(start_time DESC);

CREATE INDEX idx_audit_logs_tenant_timestamp ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_category ON audit_logs(category);
CREATE INDEX idx_audit_logs_risk_score ON audit_logs(risk_score DESC);

CREATE INDEX idx_support_tickets_tenant_status ON support_tickets(tenant_id, status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assignee ON support_tickets((assignee->>'id'));
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant_active ON user_sessions(tenant_id, is_active);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity DESC);

CREATE INDEX idx_enterprise_integrations_tenant_type ON enterprise_integrations(tenant_id, type);
CREATE INDEX idx_enterprise_integrations_status ON enterprise_integrations(status);

CREATE INDEX idx_user_role_assignments_user_active ON user_role_assignments(user_id, is_active);
CREATE INDEX idx_user_role_assignments_tenant_role ON user_role_assignments(tenant_id, role_id);

CREATE INDEX idx_data_access_logs_tenant_timestamp ON data_access_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_data_access_logs_user_sensitive ON data_access_logs(user_id, sensitive_data);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_quotas_updated_at BEFORE UPDATE ON resource_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sla_definitions_updated_at BEFORE UPDATE ON sla_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_frameworks_updated_at BEFORE UPDATE ON compliance_frameworks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enterprise_integrations_updated_at BEFORE UPDATE ON enterprise_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_articles_updated_at BEFORE UPDATE ON knowledge_base_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enterprise_roles_updated_at BEFORE UPDATE ON enterprise_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerability_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation_security_events" ON security_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_resource_quotas" ON resource_quotas
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_sla_definitions" ON sla_definitions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_sla_measurements" ON sla_measurements
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_incidents" ON incidents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_compliance_frameworks" ON compliance_frameworks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_audit_logs" ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_enterprise_integrations" ON enterprise_integrations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_support_tickets" ON support_tickets
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_user_sessions" ON user_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_enterprise_roles" ON enterprise_roles
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_user_role_assignments" ON user_role_assignments
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_vulnerability_scans" ON vulnerability_scans
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY "tenant_isolation_data_access_logs" ON data_access_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Insert default enterprise permissions
INSERT INTO enterprise_permissions (code, name, description, category, risk_level) VALUES
('admin.all', 'Full Administrator Access', 'Complete access to all system functions', 'Administration', 'critical'),
('user.read', 'View Users', 'View user profiles and basic information', 'User Management', 'low'),
('user.write', 'Manage Users', 'Create, modify, and delete user accounts', 'User Management', 'high'),
('user.roles', 'Manage User Roles', 'Assign and modify user roles and permissions', 'User Management', 'high'),
('data.read', 'View Data', 'Access to read business data and analytics', 'Data Access', 'medium'),
('data.write', 'Modify Data', 'Create and modify business data', 'Data Access', 'high'),
('data.export', 'Export Data', 'Export data from the system', 'Data Access', 'high'),
('data.delete', 'Delete Data', 'Delete business data', 'Data Access', 'critical'),
('system.config', 'System Configuration', 'Modify system settings and configuration', 'System', 'critical'),
('system.logs', 'View System Logs', 'Access system and audit logs', 'System', 'medium'),
('security.manage', 'Manage Security', 'Configure security settings and policies', 'Security', 'critical'),
('compliance.manage', 'Manage Compliance', 'Configure compliance frameworks and requirements', 'Compliance', 'high'),
('support.manage', 'Manage Support', 'Access and manage support tickets', 'Support', 'medium'),
('integration.manage', 'Manage Integrations', 'Configure and manage enterprise integrations', 'Integrations', 'high'),
('billing.read', 'View Billing', 'View billing information and invoices', 'Billing', 'medium'),
('billing.write', 'Manage Billing', 'Modify billing settings and payment methods', 'Billing', 'high');

-- Create functions for tenant management
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT, tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- This would create a tenant-specific schema if using schema isolation
    -- For now, we use RLS policies for tenant isolation
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_tenant_table(schema_name TEXT, table_name TEXT, tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- This would create tenant-specific tables if using schema isolation
    -- For now, we use shared tables with RLS policies
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_tenant_data(schema_name TEXT, tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Delete all tenant data from shared tables
    DELETE FROM security_events WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM resource_quotas WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM sla_definitions WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM sla_measurements WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM incidents WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM compliance_frameworks WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM audit_logs WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM enterprise_integrations WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM support_tickets WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM user_sessions WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM enterprise_roles WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM user_role_assignments WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM vulnerability_scans WHERE tenant_id = delete_tenant_data.tenant_id;
    DELETE FROM data_access_logs WHERE tenant_id = delete_tenant_data.tenant_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION drop_tenant_schema(schema_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- This would drop tenant schema if using schema isolation
    -- For RLS approach, this is a no-op
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE security_events IS 'Comprehensive security event logging for threat detection and compliance';
COMMENT ON TABLE tenants IS 'Multi-tenant configuration and settings';
COMMENT ON TABLE resource_quotas IS 'Resource usage limits and monitoring per tenant';
COMMENT ON TABLE sla_definitions IS 'Service Level Agreement definitions per tenant';
COMMENT ON TABLE sla_measurements IS 'SLA performance measurements and metrics';
COMMENT ON TABLE incidents IS 'Incident tracking and management';
COMMENT ON TABLE compliance_frameworks IS 'Compliance framework status and requirements';
COMMENT ON TABLE audit_logs IS 'Detailed audit trail for all system activities';
COMMENT ON TABLE enterprise_integrations IS 'Enterprise system integrations and connectors';
COMMENT ON TABLE support_tickets IS 'Enterprise support ticket management';
COMMENT ON TABLE knowledge_base_articles IS 'Self-service knowledge base articles';
COMMENT ON TABLE user_sessions IS 'Enhanced user session tracking and security';
COMMENT ON TABLE enterprise_roles IS 'Tenant-specific role definitions';
COMMENT ON TABLE enterprise_permissions IS 'System-wide permission registry';
COMMENT ON TABLE user_role_assignments IS 'User to role mappings with tenant isolation';
COMMENT ON TABLE vulnerability_scans IS 'Security vulnerability scan results';
COMMENT ON TABLE data_access_logs IS 'Detailed data access tracking for compliance';