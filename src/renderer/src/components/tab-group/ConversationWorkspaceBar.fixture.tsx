import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { ConversationWorkspaceBar } from './ConversationWorkspaceBar'

function WorkspacePreview(): React.JSX.Element {
  const [conversation, setConversation] = useState<string | null>('simulation')
  const [surface, setSurface] = useState('chat')
  const [changes, setChanges] = useState(false)
  const [tabs, setTabs] = useState(false)
  return (
    <ConversationWorkspaceBar
      conversations={[
        { id: 'simulation', title: 'Build the robot simulation' },
        { id: 'controller', title: 'Review the controller' },
        { id: 'docs', title: 'Update project documentation' }
      ]}
      activeConversationId={conversation}
      browserActive={surface === 'browser'}
      terminalActive={surface === 'terminal'}
      changesOpen={changes}
      tabsOpen={tabs}
      onConversation={(id) => {
        setConversation(id)
        setSurface('chat')
      }}
      onBrowser={() => {
        setSurface('browser')
        setConversation(null)
      }}
      onTerminal={() => {
        setSurface('terminal')
        setConversation(null)
      }}
      onChanges={() => setChanges(!changes)}
      onToggleTabs={() => setTabs(!tabs)}
      newConversation={
        <Button variant="ghost" size="sm">
          New conversation
        </Button>
      }
    />
  )
}

export const desktop = defineFixture({ width: 980, render: () => <WorkspacePreview /> })
export const narrow = defineFixture({ width: 360, render: () => <WorkspacePreview /> })
