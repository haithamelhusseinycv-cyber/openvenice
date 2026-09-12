import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const tokens = {
  github: (process.env.GITHUB_CONNECTOR_TOKEN || process.env.GITHUB_TOKEN || '').trim(),
  graph: (process.env.MICROSOFT_GRAPH_TOKEN || '').trim(),
  exa: (process.env.EXA_API_KEY || '').trim(),
  tavily: (process.env.TAVILY_API_KEY || '').trim(),
}

function hostProxy(target: string, prefix: string, headers: Record<string, string>): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.replace(new RegExp(`^${prefix}`), '') || '/',
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('cookie')
        proxyReq.removeHeader('authorization')
        proxyReq.removeHeader('proxy-authorization')
        for (const [key, value] of Object.entries(headers)) proxyReq.setHeader(key, value)
      })
    },
  }
}

function connectorStatusPlugin(): Plugin {
  return {
    name: 'openvenice-connectors',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/connectors/status' || url.startsWith('/connectors/status?')) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({
            github: Boolean(tokens.github),
            graph: Boolean(tokens.graph),
            exa: Boolean(tokens.exa),
            tavily: Boolean(tokens.tavily),
          }))
          return
        }

        const prefixes: Array<[string, string]> = [
          ['/connectors/github', tokens.github],
          ['/connectors/graph', tokens.graph],
          ['/connectors/exa', tokens.exa],
          ['/connectors/tavily', tokens.tavily],
        ]
        for (const [prefix, token] of prefixes) {
          if (url === prefix || url.startsWith(`${prefix}/`)) {
            if (!token) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify({ error: `${prefix.replace('/connectors/', '')} connector is not configured` }))
              return
            }
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), connectorStatusPlugin()],
  server: {
    proxy: {
      '/venice': {
        target: 'https://api.venice.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/venice/, ''),
      },
      '/connectors/github': hostProxy('https://api.github.com', '/connectors/github', {
        Authorization: `Bearer ${tokens.github}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OpenVenice-Shahy',
        'X-GitHub-Api-Version': '2022-11-28',
      }),
      '/connectors/graph': hostProxy('https://graph.microsoft.com/v1.0', '/connectors/graph', {
        Authorization: `Bearer ${tokens.graph}`,
      }),
      '/connectors/exa': hostProxy('https://api.exa.ai', '/connectors/exa', {
        'x-api-key': tokens.exa,
      }),
      '/connectors/tavily': hostProxy('https://api.tavily.com', '/connectors/tavily', {
        Authorization: `Bearer ${tokens.tavily}`,
      }),
    },
  },
})
