-- Enhanced Vector Database for RAG System
-- This migration extends the basic vector store with advanced features

-- Create content type enum for better organization
CREATE TYPE content_type AS ENUM (
  'product',
  'customer', 
  'order',
  'content',
  'faq',
  'knowledge_base',
  'review',
  'marketing',
  'support_ticket',
  'conversation'
);

-- Create enhanced documents table with better structure
CREATE TABLE IF NOT EXISTS documents_enhanced (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  content_type content_type NOT NULL,
  title VARCHAR(500),
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  chunk_index INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 1,
  parent_document_id UUID REFERENCES documents_enhanced(id),
  store_id UUID NOT NULL,
  source_id VARCHAR(255), -- Original ID from source system
  source_url TEXT,
  language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'active',
  
  -- Full text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(summary, ''))
  ) STORED
);

-- Create specialized tables for different content types

-- Product embeddings with enhanced metadata
CREATE TABLE IF NOT EXISTS product_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents_enhanced(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  product_type VARCHAR(255),
  vendor VARCHAR(255),
  handle VARCHAR(255),
  tags TEXT[],
  price_range NUMRANGE,
  inventory_count INTEGER,
  variants JSONB DEFAULT '[]',
  collections JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  seo_data JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}', -- sales data, views, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer interaction embeddings
CREATE TABLE IF NOT EXISTS customer_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents_enhanced(id) ON DELETE CASCADE,
  customer_id VARCHAR(255),
  store_id UUID NOT NULL,
  interaction_type VARCHAR(100), -- review, support, chat, etc.
  sentiment_score REAL,
  intent_classification VARCHAR(100),
  priority_level INTEGER DEFAULT 1,
  resolution_status VARCHAR(50),
  satisfaction_rating INTEGER,
  contact_info JSONB DEFAULT '{}',
  purchase_history JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base articles with hierarchy
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents_enhanced(id) ON DELETE CASCADE,
  article_id VARCHAR(255),
  store_id UUID NOT NULL,
  category VARCHAR(255),
  subcategory VARCHAR(255),
  difficulty_level INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  outdated BOOLEAN DEFAULT FALSE,
  author VARCHAR(255),
  reviewer VARCHAR(255),
  approval_status VARCHAR(50) DEFAULT 'draft',
  related_articles UUID[],
  required_permissions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector clustering for content organization
CREATE TABLE IF NOT EXISTS vector_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_name VARCHAR(255) NOT NULL,
  content_type content_type NOT NULL,
  store_id UUID NOT NULL,
  centroid VECTOR(1536),
  member_count INTEGER DEFAULT 0,
  average_similarity REAL,
  cluster_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster membership mapping
CREATE TABLE IF NOT EXISTS document_clusters (
  document_id UUID REFERENCES documents_enhanced(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES vector_clusters(id) ON DELETE CASCADE,
  similarity_to_centroid REAL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, cluster_id)
);

-- Performance indexes for enhanced tables

-- Main documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_enhanced_embedding 
ON documents_enhanced USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_content_type 
ON documents_enhanced (content_type);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_store_id 
ON documents_enhanced (store_id);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_parent 
ON documents_enhanced (parent_document_id);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_search 
ON documents_enhanced USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_metadata 
ON documents_enhanced USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_status 
ON documents_enhanced (status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_documents_enhanced_indexed_at 
ON documents_enhanced (indexed_at DESC);

-- Product embeddings indexes
CREATE INDEX IF NOT EXISTS idx_product_embeddings_product_id 
ON product_embeddings (product_id, store_id);

CREATE INDEX IF NOT EXISTS idx_product_embeddings_tags 
ON product_embeddings USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_product_embeddings_price_range 
ON product_embeddings USING GIST (price_range);

CREATE INDEX IF NOT EXISTS idx_product_embeddings_type_vendor 
ON product_embeddings (product_type, vendor);

-- Customer embeddings indexes
CREATE INDEX IF NOT EXISTS idx_customer_embeddings_customer_id 
ON customer_embeddings (customer_id, store_id);

CREATE INDEX IF NOT EXISTS idx_customer_embeddings_sentiment 
ON customer_embeddings (sentiment_score) WHERE sentiment_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_embeddings_intent 
ON customer_embeddings (intent_classification);

CREATE INDEX IF NOT EXISTS idx_customer_embeddings_priority 
ON customer_embeddings (priority_level, resolution_status);

-- Knowledge embeddings indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_category 
ON knowledge_embeddings (category, subcategory);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_approval 
ON knowledge_embeddings (approval_status);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_helpful 
ON knowledge_embeddings (helpful_votes DESC);

-- Vector clusters indexes
CREATE INDEX IF NOT EXISTS idx_vector_clusters_centroid 
ON vector_clusters USING ivfflat (centroid vector_cosine_ops) 
WITH (lists = 20);

CREATE INDEX IF NOT EXISTS idx_vector_clusters_type_store 
ON vector_clusters (content_type, store_id);

-- Document clusters indexes
CREATE INDEX IF NOT EXISTS idx_document_clusters_similarity 
ON document_clusters (similarity_to_centroid DESC);

-- Advanced similarity search function with filters
CREATE OR REPLACE FUNCTION enhanced_similarity_search(
  query_embedding VECTOR(1536),
  search_content_type content_type DEFAULT NULL,
  search_store_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_metadata JSONB DEFAULT NULL,
  exclude_chunks BOOLEAN DEFAULT FALSE,
  min_chunk_similarity FLOAT DEFAULT 0.8
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  title VARCHAR(500),
  content_type content_type,
  metadata JSONB,
  similarity FLOAT,
  chunk_info JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.title,
    d.content_type,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity,
    jsonb_build_object(
      'chunk_index', d.chunk_index,
      'chunk_count', d.chunk_count,
      'parent_id', d.parent_document_id
    ) AS chunk_info
  FROM documents_enhanced d
  WHERE 
    d.status = 'active'
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
    AND (search_content_type IS NULL OR d.content_type = search_content_type)
    AND (search_store_id IS NULL OR d.store_id = search_store_id)
    AND (filter_metadata IS NULL OR d.metadata @> filter_metadata)
    AND (NOT exclude_chunks OR d.parent_document_id IS NULL)
    AND (d.parent_document_id IS NULL OR 
         1 - (d.embedding <=> query_embedding) > min_chunk_similarity)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search combining vector and full-text search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(1536),
  search_store_id UUID DEFAULT NULL,
  vector_weight FLOAT DEFAULT 0.7,
  text_weight FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  title VARCHAR(500),
  content_type content_type,
  metadata JSONB,
  vector_similarity FLOAT,
  text_similarity FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      d.id,
      d.content,
      d.title,
      d.content_type,
      d.metadata,
      1 - (d.embedding <=> query_embedding) AS vector_sim
    FROM documents_enhanced d
    WHERE 
      d.status = 'active'
      AND d.embedding IS NOT NULL
      AND (search_store_id IS NULL OR d.store_id = search_store_id)
  ),
  text_results AS (
    SELECT
      d.id,
      ts_rank_cd(d.search_vector, plainto_tsquery('english', query_text)) AS text_sim
    FROM documents_enhanced d
    WHERE 
      d.status = 'active'
      AND d.search_vector @@ plainto_tsquery('english', query_text)
      AND (search_store_id IS NULL OR d.store_id = search_store_id)
  )
  SELECT
    v.id,
    v.content,
    v.title,
    v.content_type,
    v.metadata,
    v.vector_sim,
    COALESCE(t.text_sim, 0.0) AS text_similarity,
    (vector_weight * v.vector_sim + text_weight * COALESCE(t.text_sim, 0.0)) AS combined_score
  FROM vector_results v
  LEFT JOIN text_results t ON v.id = t.id
  WHERE (vector_weight * v.vector_sim + text_weight * COALESCE(t.text_sim, 0.0)) > match_threshold
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Cluster-based similarity search for faster retrieval
CREATE OR REPLACE FUNCTION cluster_similarity_search(
  query_embedding VECTOR(1536),
  search_content_type content_type DEFAULT NULL,
  search_store_id UUID DEFAULT NULL,
  cluster_count INT DEFAULT 3,
  documents_per_cluster INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  title VARCHAR(500),
  content_type content_type,
  metadata JSONB,
  similarity FLOAT,
  cluster_name VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH top_clusters AS (
    SELECT 
      c.id as cluster_id,
      c.cluster_name,
      1 - (c.centroid <=> query_embedding) AS cluster_similarity
    FROM vector_clusters c
    WHERE 
      (search_content_type IS NULL OR c.content_type = search_content_type)
      AND (search_store_id IS NULL OR c.store_id = search_store_id)
    ORDER BY c.centroid <=> query_embedding
    LIMIT cluster_count
  ),
  cluster_documents AS (
    SELECT 
      d.id,
      d.content,
      d.title,
      d.content_type,
      d.metadata,
      1 - (d.embedding <=> query_embedding) AS similarity,
      tc.cluster_name,
      ROW_NUMBER() OVER (PARTITION BY tc.cluster_id ORDER BY d.embedding <=> query_embedding) as rn
    FROM top_clusters tc
    JOIN document_clusters dc ON tc.cluster_id = dc.cluster_id
    JOIN documents_enhanced d ON dc.document_id = d.id
    WHERE d.status = 'active'
  )
  SELECT 
    cd.id,
    cd.content,
    cd.title,
    cd.content_type,
    cd.metadata,
    cd.similarity,
    cd.cluster_name
  FROM cluster_documents cd
  WHERE cd.rn <= documents_per_cluster
  ORDER BY cd.similarity DESC;
END;
$$;

-- Function to update document statistics
CREATE OR REPLACE FUNCTION update_document_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cluster member count
  IF TG_OP = 'INSERT' THEN
    UPDATE vector_clusters 
    SET member_count = member_count + 1
    WHERE id = NEW.cluster_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE vector_clusters 
    SET member_count = member_count - 1
    WHERE id = OLD.cluster_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for cluster statistics
CREATE TRIGGER update_cluster_stats
  AFTER INSERT OR DELETE ON document_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_document_stats();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_documents_enhanced_updated_at
  BEFORE UPDATE ON documents_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_enhanced();

CREATE TRIGGER update_product_embeddings_updated_at
  BEFORE UPDATE ON product_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_enhanced();

CREATE TRIGGER update_customer_embeddings_updated_at
  BEFORE UPDATE ON customer_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_enhanced();

CREATE TRIGGER update_knowledge_embeddings_updated_at
  BEFORE UPDATE ON knowledge_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_enhanced();

CREATE TRIGGER update_vector_clusters_updated_at
  BEFORE UPDATE ON vector_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_enhanced();

-- Row Level Security policies
ALTER TABLE documents_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_clusters ENABLE ROW LEVEL SECURITY;

-- Policies for documents_enhanced
CREATE POLICY "Users can access their store documents" ON documents_enhanced
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM store_users 
      WHERE store_id = documents_enhanced.store_id
    )
  );

CREATE POLICY "Service role can access all documents" ON documents_enhanced
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for specialized tables
CREATE POLICY "Users can access their store product embeddings" ON product_embeddings
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM store_users 
      WHERE store_id = product_embeddings.store_id
    )
  );

CREATE POLICY "Service role can access all product embeddings" ON product_embeddings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can access their store customer embeddings" ON customer_embeddings
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM store_users 
      WHERE store_id = customer_embeddings.store_id
    )
  );

CREATE POLICY "Service role can access all customer embeddings" ON customer_embeddings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can access their store knowledge embeddings" ON knowledge_embeddings
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM store_users 
      WHERE store_id = knowledge_embeddings.store_id
    )
  );

CREATE POLICY "Service role can access all knowledge embeddings" ON knowledge_embeddings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can access their store clusters" ON vector_clusters
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM store_users 
      WHERE store_id = vector_clusters.store_id
    )
  );

CREATE POLICY "Service role can access all clusters" ON vector_clusters
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can access their document clusters" ON document_clusters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents_enhanced d
      JOIN store_users su ON d.store_id = su.store_id
      WHERE d.id = document_clusters.document_id
      AND su.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can access all document clusters" ON document_clusters
  FOR ALL USING (auth.role() = 'service_role');

-- Create materialized view for fast analytics
CREATE MATERIALIZED VIEW vector_store_analytics AS
SELECT 
  store_id,
  content_type,
  COUNT(*) as document_count,
  AVG(LENGTH(content)) as avg_content_length,
  COUNT(DISTINCT CASE WHEN parent_document_id IS NULL THEN id END) as parent_documents,
  COUNT(DISTINCT CASE WHEN parent_document_id IS NOT NULL THEN id END) as chunks,
  MAX(created_at) as latest_document,
  COUNT(DISTINCT DATE(created_at)) as active_days
FROM documents_enhanced
WHERE status = 'active'
GROUP BY store_id, content_type;

-- Index for the materialized view
CREATE INDEX idx_vector_store_analytics_store_type ON vector_store_analytics (store_id, content_type);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_vector_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vector_store_analytics;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE documents_enhanced IS 'Enhanced vector storage with content type organization and chunking support';
COMMENT ON TABLE product_embeddings IS 'Product-specific embeddings with e-commerce metadata';
COMMENT ON TABLE customer_embeddings IS 'Customer interaction embeddings with sentiment and intent';
COMMENT ON TABLE knowledge_embeddings IS 'Knowledge base articles with hierarchy and approval workflow';
COMMENT ON TABLE vector_clusters IS 'Vector clustering for content organization and faster retrieval';
COMMENT ON TABLE document_clusters IS 'Mapping between documents and their clusters';

COMMENT ON FUNCTION enhanced_similarity_search IS 'Advanced similarity search with content type and metadata filtering';
COMMENT ON FUNCTION hybrid_search IS 'Combines vector similarity with full-text search for better results';
COMMENT ON FUNCTION cluster_similarity_search IS 'Cluster-based search for improved performance on large datasets';

-- Create sample data for testing (commented out for production)
/*
INSERT INTO documents_enhanced (content, content_type, title, store_id, metadata) VALUES 
('Sample product description for testing enhanced vector search', 
 'product', 
 'Test Product',
 '550e8400-e29b-41d4-a716-446655440000'::UUID,
 '{"category": "test", "price": 29.99}'::JSONB);
*/