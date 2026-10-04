"use client";
import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [activeTab, setActiveTab] = useState('dev');
  return (
    <main>
      {/* Navigation */}
      <nav className="glass-nav">
        <div className="container nav-content">
          <div className="nav-logo">
            <span style={{ fontSize: "1.5rem" }}>⚙️</span> StitsOS
          </div>
          <div>
            <a href="https://stitsos.fidycard.com.br" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
              Developer Login
            </a>
          </div>
        </div>
      </nav>

      <div className="container">
        {/* Hero Section */}
        <section className="hero">
          <div className="badge">Sistema Operacional Interno</div>
          <h1>
            The Intelligence Engine of <br />
            <span className="gradient-text">Stits AI Holding</span>
          </h1>
          <p>
            StitsOS é o hub central de arquitetura, identidade e integração para todos os sistemas da Holding. Conectando o StitsPay, ZennTec, BlogSmart e muito mais.
          </p>
          <div className="hero-actions">
            <a href="https://stitsos.fidycard.com.br" className="btn btn-primary">
              Acessar SSO Hub ➔
            </a>
            <a href="#features" className="btn btn-secondary">
              Ver Arquitetura
            </a>
          </div>
          
          <div className="status-dashboard">
            <div className="status-pill">
              <span>🟢</span>
              <span className="status-value">99.99%</span>
              <span style={{ color: "var(--text-dim)" }}>Uptime</span>
            </div>
            <div className="status-pill">
              <span>⚡</span>
              <span className="status-value">12ms</span>
              <span style={{ color: "var(--text-dim)" }}>SSO Latency</span>
            </div>
            <div className="status-pill">
              <span>🛡️</span>
              <span className="status-value">2.4M+</span>
              <span style={{ color: "var(--text-dim)" }}>Requests Seguros</span>
            </div>
          </div>
        </section>

        {/* Architecture Diagram */}
        <section className="diagram-container">
          <div className="diagram-core">
            <span style={{ fontSize: "2rem" }}>⚙️</span>
            <span style={{ fontWeight: 800, marginTop: "4px" }}>StitsOS</span>
            <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>Engine</span>
          </div>
          <div className="diagram-nodes">
            <div className="diagram-node">
              <span className="node-icon">💳</span>
              <span style={{ fontWeight: 600 }}>StitsPay</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Gateway Auth</span>
            </div>
            <div className="diagram-node">
              <span className="node-icon">🏢</span>
              <span style={{ fontWeight: 600 }}>Gestor-Nex</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Tenant Auth</span>
            </div>
            <div className="diagram-node">
              <span className="node-icon">✍️</span>
              <span style={{ fontWeight: 600 }}>BlogSmart</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>API Access</span>
            </div>
            <div className="diagram-node">
              <span className="node-icon">🤖</span>
              <span style={{ fontWeight: 600 }}>ZennTec</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>IoT Auth</span>
            </div>
          </div>
        </section>

        {/* Core Infrastructure */}
        <section id="features" style={{ paddingTop: "40px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h2>Infraestrutura Centralizada</h2>
            <p style={{ color: "var(--text-dim)", marginTop: "8px" }}>Tudo o que os nossos produtos precisam para escalar globalmente.</p>
          </div>

          <div className="features-grid">
            {/* Auth */}
            <div className="glass-panel feature-card">
              <div className="feature-icon">🛡️</div>
              <h3 className="feature-title">StitsOS Auth (SSO)</h3>
              <p className="feature-desc">
                Identidade unificada (Single Sign-On) para os usuários. Faça login uma vez e navegue livremente pelo StitsPay, BlogSmart e GestorNex com Role-Based Access Control (RBAC).
              </p>
            </div>

            {/* Notifications */}
            <div className="glass-panel feature-card">
              <div className="feature-icon">📨</div>
              <h3 className="feature-title">Notification Engine</h3>
              <p className="feature-desc">
                Motor central de comunicação assíncrona. Disparo orquestrado de E-mails via AWS SES/Resend e WhatsApp, utilizado por todos os produtos da holding.
              </p>
            </div>

            {/* Nexus Webhooks */}
            <div className="glass-panel feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Nexus Webhooks</h3>
              <p className="feature-desc">
                O "Cérebro" de integrações B2B. Recebe eventos do Busca Leads AI e ZennTec para injetar instantaneamente clientes no Nexus CRM através de webhooks seguros.
              </p>
            </div>

            {/* Agent Memory */}
            <div className="glass-panel feature-card">
              <div className="feature-icon">🧠</div>
              <h3 className="feature-title">StitsAgent Context</h3>
              <p className="feature-desc">
                Inteligência Artificial interna (LLM). Mapeia automaticamente repositórios, analisa git status e mantém a memória técnica de todo o ecossistema atualizada.
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section style={{ marginTop: "100px" }}>
          <div className="glass-panel" style={{ padding: "40px" }}>
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'dev' ? 'active' : ''}`}
                onClick={() => setActiveTab('dev')}
              >
                Para Desenvolvedores
              </button>
              <button 
                className={`tab-btn ${activeTab === 'gestores' ? 'active' : ''}`}
                onClick={() => setActiveTab('gestores')}
              >
                Para Gestores/Fundadores
              </button>
              <button 
                className={`tab-btn ${activeTab === 'seguranca' ? 'active' : ''}`}
                onClick={() => setActiveTab('seguranca')}
              >
                Segurança & Parceiros
              </button>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: "40px", alignItems: "center", minHeight: "280px" }}>
              {activeTab === 'dev' && (
                <>
                  <div style={{ flex: "1 1 400px" }}>
                    <div className="badge">API & SDKs</div>
                    <h2 style={{ marginBottom: "16px" }}>Integração Sem Fricção</h2>
                    <p style={{ color: "var(--text-dim)", marginBottom: "24px" }}>
                      Não perca tempo construindo autenticação do zero em cada startup. Apenas importe o SDK do StitsOS e gerencie logins, sessões e roles em duas linhas de código.
                    </p>
                    <a href="#" className="btn btn-secondary">Acessar GitHub</a>
                  </div>
                  <div style={{ flex: "1 1 400px", width: "100%" }}>
                    <div className="code-block" style={{ borderLeft: "4px solid var(--primary)" }}>
                      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></div>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }}></div>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></div>
                      </div>
                      <span style={{ color: "#f472b6" }}>import</span> {"{ StitsAuth }"} <span style={{ color: "#f472b6" }}>from</span> <span style={{ color: "#a3e635" }}>'@stitsos/sdk'</span>;<br /><br />
                      <span style={{ color: "#60a5fa" }}>const</span> sso = <span style={{ color: "#f472b6" }}>new</span> StitsAuth({"{"}<br />
                      &nbsp;&nbsp;tenantId: <span style={{ color: "#a3e635" }}>'stitspay_live'</span>,<br />
                      &nbsp;&nbsp;apiKey: process.env.STITSOS_SECRET<br />
                      {"});"}<br /><br />
                      <span style={{ color: "#94a3b8" }}>// Validando usuário em qualquer app</span><br />
                      <span style={{ color: "#60a5fa" }}>const</span> user = <span style={{ color: "#f472b6" }}>await</span> sso.validateSession(token);<br />
                      <span style={{ color: "#fbbf24" }}>console</span>.log(user.rbac.role); <span style={{ color: "#94a3b8" }}>// 'admin_financeiro'</span>
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === 'gestores' && (
                <>
                  <div style={{ flex: "1 1 400px" }}>
                    <div className="badge">Venture Builder Hub</div>
                    <h2 style={{ marginBottom: "16px" }}>Dados Centralizados e Redução de CAC</h2>
                    <p style={{ color: "var(--text-dim)", marginBottom: "24px" }}>
                      O StitsOS permite que um cliente cadastrado no StitsPay faça login no GestorNex com a mesma conta. Compartilhamento de base de dados significa que as verticais da Holding crescem em sinergia, diminuindo o Custo de Aquisição de Clientes.
                    </p>
                    <a href="http://localhost:4000" className="btn btn-primary">Ver Portfólio Holding</a>
                  </div>
                  <div style={{ flex: "1 1 400px", textAlign: "center" }}>
                    <div style={{ fontSize: "5rem", opacity: 0.8 }}>📈</div>
                    <h3 style={{ marginTop: "16px", color: "var(--accent-emerald)" }}>Zero Silos de Dados</h3>
                    <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>O ecossistema trabalha como um organismo único.</p>
                  </div>
                </>
              )}
              
              {activeTab === 'seguranca' && (
                <>
                  <div style={{ flex: "1 1 400px" }}>
                    <div className="badge">Enterprise Security</div>
                    <h2 style={{ marginBottom: "16px" }}>Controle de Acesso Granular (RBAC)</h2>
                    <p style={{ color: "var(--text-dim)", marginBottom: "24px" }}>
                      Segurança de nível bancário nativa. O sistema gerencia hierarquias complexas para parceiros B2B, garantindo que franqueados do Stits Zyon acessem apenas suas máquinas, enquanto diretores visualizam o mapa global.
                    </p>
                    <a href="https://stitsos.fidycard.com.br" className="btn btn-secondary">Acessar Painel de Controle</a>
                  </div>
                  <div style={{ flex: "1 1 400px", textAlign: "center" }}>
                    <div style={{ fontSize: "5rem", opacity: 0.8 }}>🔐</div>
                    <h3 style={{ marginTop: "16px", color: "var(--primary)" }}>Criptografia Ponta a Ponta</h3>
                    <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>JWT, Tokens Atualizáveis e Auditoria Contínua.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <p style={{ margin: 0, textAlign: "left" }}>© 2026 Stits AI Holding. Todos os direitos reservados.</p>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(255,255,255,0.03)", padding: "10px 20px", borderRadius: "100px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--text-dim)" }}>Uma empresa <span style={{ color: "#10b981", fontWeight: "600" }}>Stits AI Holding</span></span>
            <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)" }}></div>
            <span style={{ color: "var(--text-main)" }}>Powered by <span style={{ color: "#f8fafc" }}>✦ <strong>StitsOS</strong></span></span>
          </div>
        </footer>
      </div>
    </main>
  );
}
