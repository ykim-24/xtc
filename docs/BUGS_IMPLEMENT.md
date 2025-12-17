### Implement

- Ability to stop/clear session (parallel work) add in the modal to stop session and if you right click the session icon in the bottom right a context menu that includes an option to stop session. Make sure to clean up as well.
- Add pre queue message to claude right now we have to wait till claude finishes to add new prompt but claude currently in the ide we are able to queue and get picked up after claude responds
- Allow interuptions so claude can stop when we want it to in the main chat
- Make the icons in the worktree have like a border spinning around the box instead of it just being static around the box
- When editor approve/reject shows up also add a list nav on the left to click through the changes instead of scrolling and looking for the green and red (default will scroll to the first)
- Add cmd+shift+f global keyword search through the whole repo (like VSCode)

### Bugs

- Token usage in the git page does not retain after refresh should be saved untill the branch/worktree is removed
- While worktree is working in background during planning phase the session icon in the bottom right does not appear
- The question modal when claude prompts it is slightly miss-parsed most likely due to parsing ex:
  1. Background section styling: The ticket mentions "make this blue with the underline" for Background. Should Background use the same "blue" boxed style as Key Takeaways, or should it use a different style (e.g., the gray style like Relevant Experience)?
  2. Granular Notes sections styling: For the dynamic theme sections (e.g., "## Service Offerings", "## Pricing", "## Competitive Landscape"), should each theme:
  3. Be rendered as a separate blue boxed section (like Key Takeaways)?
  4. Or use a different visual treatment?
  5. Section ordering: The new prompt specifies "Background" should come first among the Granular Notes, but after Key Takeaways in the output. Should the export render them in this order: Relevant Experience → Key Takeaways → Background → [Other Theme Sections]?
  6. Placeholder handling: The new prompt says "Relevant Experience" should contain `[ placeholder ]`. Should the export skip rendering this section if it only contains placeholder text?
  7. Example document: Is there an example DOCX output showing the expected visual format? This would help confirm the exact styling requirements for the new sections.
- Zoom in/out doesn't work all the time properly probably due to unmounting eventlistener
