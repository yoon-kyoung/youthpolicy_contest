import { useState } from 'react'
import Icon from '../../../../styles/Icon'

function TodoList({ items }) {
  const [todos, setTodos] = useState(items)

  const toggleTodo = (index) => {
    setTodos((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, done: !item.done } : item,
      ),
    )
  }

  const doneCount = todos.filter(t => t.done).length

  return (
    <article className="panel-card compact-panel">
      <div className="section-heading">
        <div>
          <h3>오늘의 할 일</h3>
        </div>
        <span className="text-muted">{doneCount} / {todos.length} 완료</span>
      </div>
      <div className="todo-list">
        {todos.map((item, index) => (
          <button
            key={`${item.title}-${item.due}`}
            className={`todo-item${item.done ? ' todo-item-done' : ''}`}
            type="button"
            onClick={() => toggleTodo(index)}
          >
            <span className="todo-checkbox">{item.done && <Icon name="check" size={13} color="#ffffff" />}</span>
            <div>
              <strong style={item.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{item.title}</strong>
              <p>{item.done ? '완료됨' : item.due}</p>
            </div>
          </button>
        ))}
      </div>
    </article>
  )
}

export default TodoList
