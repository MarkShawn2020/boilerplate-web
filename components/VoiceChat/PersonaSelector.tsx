import { Avatar } from "./Avatar"
import { Persona } from "../../store/voice-chat-store"

interface PersonaSelectorProps {
  personas: Persona[]
  selectedPersona: Persona
  onSelect: (persona: Persona) => void
}

export function PersonaSelector({ personas, selectedPersona, onSelect }: PersonaSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {personas.map((persona) => (
        <button
          key={persona.id}
          onClick={() => onSelect(persona)}
          className={`
            p-3 rounded-2xl border-2 transition-all duration-200
            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500
            ${selectedPersona.id === persona.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-2">
            <Avatar persona={persona} size="small" />
            <span className={`
              text-xs font-medium truncate w-full
              ${selectedPersona.id === persona.id
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300'
              }
            `}>
              {persona.name}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
