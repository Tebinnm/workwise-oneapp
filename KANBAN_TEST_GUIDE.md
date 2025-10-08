# Kanban Board Drag & Drop - Testing Guide

## Quick Test Steps

### 1. Navigate to a Project Board

1. Start the development server: `npm run dev`
2. Log in to the application
3. Navigate to any project board
4. Switch to **Kanban view** (should be default)

### 2. Basic Drag & Drop Test

- [ ] **Drag a task from "Open" to "In Progress"**

  - Click and hold on the task title/grip area
  - Drag to the "In Progress" column
  - Release the mouse
  - Verify the task appears in the new column
  - Check for success toast notification

- [ ] **Drag a task from "In Progress" to "Done"**

  - Repeat the process
  - Verify the task moves and UI updates

- [ ] **Drag a task back to "Open"**
  - Test reverse direction movement
  - Confirm all directions work

### 3. Visual Feedback Test

- [ ] **Hover states during drag**

  - While dragging, column should show visual feedback (ring/highlight)
  - Drag overlay should follow cursor
  - Original card should be semi-transparent

- [ ] **Empty column behavior**
  - If a column is empty, verify the "No tasks" placeholder
  - While dragging over empty column, text should change to "Drop here"
  - Border should become solid and colored

### 4. Interactive Elements Test

- [ ] **Edit button still works**

  - Click the Edit button (pencil icon) on a task
  - Verify the edit dialog opens without starting a drag

- [ ] **More options button works**
  - Click the three-dot menu icon
  - Verify it doesn't interfere with drag functionality

### 5. Edge Cases

- [ ] **Drag and release outside columns**

  - Start dragging a task
  - Release mouse outside any column
  - Task should stay in original position

- [ ] **Quick drag movements**

  - Rapidly drag tasks between columns
  - Verify all movements are tracked correctly

- [ ] **Multiple tasks in columns**
  - Test with columns containing many tasks
  - Verify scrolling works if needed

### 6. Mobile/Responsive Test (if applicable)

- [ ] Resize browser to mobile width
- [ ] Verify drag still works on smaller screens
- [ ] Check that touch events work (if on touch device)

## Expected Results

### ✅ Success Indicators

- Tasks move smoothly between columns
- Toast notifications appear on successful moves
- UI updates immediately after drop
- Budget summary updates (if visible)
- No console errors
- Action buttons remain functional

### ❌ Potential Issues to Watch For

- Tasks not moving when dropped
- Multiple tasks appearing/disappearing
- Console errors during drag operations
- Buttons not clickable
- Visual glitches during drag
- Network errors in console

## Troubleshooting

### If drag doesn't work:

1. Check browser console for errors
2. Verify you're logged in
3. Check network tab for failed API calls
4. Ensure tasks have valid IDs
5. Verify database connection

### If UI doesn't update:

1. Check if toast notification appears
2. Manually refresh the page
3. Check network tab for database update calls
4. Verify Supabase realtime subscriptions are working

## Performance Notes

- First drag may feel slightly slower (network request)
- Subsequent drags should be quick
- Large number of tasks (50+) may affect performance
- Budget recalculation happens after each move

## Browser Compatibility

Tested and working on:

- ✅ Chrome/Edge (Chromium-based)
- ✅ Firefox
- ✅ Safari (may need testing)

## Need Help?

If you encounter issues:

1. Check `KANBAN_DRAG_DROP_FIX.md` for implementation details
2. Review browser console for error messages
3. Verify Supabase connection is active
4. Check that `@dnd-kit` packages are properly installed

