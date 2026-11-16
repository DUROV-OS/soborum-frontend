import { Link } from 'react-router-dom'
import { ArrowUpRight, Bell, UsersRound } from 'lucide-react'
import { useCollaborationTools } from './useCollaborationTools'
import { ToolIcon } from './ToolIcon'

export function CollaborationPage() {
  const tools = useCollaborationTools(), available = tools.filter(tool => tool.to), planned = tools.filter(tool => !tool.to)
  return <div className="collaboration-workspace">
    <header className="collaboration-heading"><div><span className="collaboration-eyebrow"><UsersRound size={16}/>Рабочее пространство команды</span><h1>Совместная работа</h1><p>Обсуждайте вопросы, ставьте задачи и сохраняйте решения в одном рабочем пространстве.</p></div><Link to="/notifications" className="collaboration-notifications"><Bell size={18}/><span>Уведомления</span></Link></header>
    <section aria-label="Доступные инструменты" className="collaboration-tools">{available.map(tool => <Link key={tool.id} to={tool.to!} className={`collaboration-tool collaboration-tool--${tool.accent}`}>
      <div className="collaboration-tool-top"><span className="collaboration-tool-icon"><ToolIcon id={tool.id} size={25}/></span><ArrowUpRight size={19} aria-hidden="true"/></div>
      <h2>{tool.label}</h2><p>{tool.description}</p><span className="collaboration-tool-action">{tool.id === 'messenger' ? 'Открыть чаты MAX' : tool.id === 'gpt' ? 'Открыть Durov GPT' : tool.id === 'tasks' ? 'Перейти к задачам' : tool.id === 'calendar' ? 'Открыть календарь' : tool.id === 'projects' ? 'Открыть проекты' : 'Открыть совещания'}<ArrowUpRight size={14}/></span>
    </Link>)}</section>
    <section className="collaboration-next" aria-labelledby="collaboration-next-title"><div><h2 id="collaboration-next-title">Дальше — ещё больше совместной работы</h2><p>Эти инструменты пока недоступны. Они появятся здесь по мере запуска.</p></div><ul>{planned.map(tool => <li key={tool.id}><ToolIcon id={tool.id}/><div><span className="font-semibold">{tool.label}</span><p>{tool.description}</p></div><span className="collaboration-soon">Скоро</span></li>)}</ul></section>
  </div>
}
