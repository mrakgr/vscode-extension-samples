'use strict';

import { MarkdownString, Comment, Range, CommentMode, CommentAuthorInformation, CommentThread, ExtensionContext, comments, TextDocument, CancellationToken, commands, CommentReply, CommentThreadCollapsibleState, workspace } from 'vscode';

let commentId = 1;

class NoteComment implements Comment {
	id: number = ++commentId;
	label: string | undefined;
	constructor(
		public body: string | MarkdownString,
		public mode: CommentMode,
		public author: CommentAuthorInformation,
		public parent?: CommentThread,
		public contextValue?: string
	) { }
}

const replyNote = (reply: CommentReply) => {
	let thread = reply.thread;
	let newComment = new NoteComment(reply.text, CommentMode.Preview, { name: 'vscode' }, thread, thread.comments.length ? 'canDelete' : undefined);
	if (thread.contextValue === 'draft') { newComment.label = 'pending'; }

	thread.comments = [...thread.comments, newComment];
};

export function activate(context: ExtensionContext) {
	// A `CommentController` is able to provide comments for documents.
	const commentController = comments.createCommentController('comment-sample', 'Comment API Sample');

	// A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document: TextDocument, token: CancellationToken) => {
			let lineCount = document.lineCount;
			return [new Range(0, 0, lineCount - 1, 0)];
		}
	};
	context.subscriptions.push(
		commentController,
		commands.registerCommand('mywiki.createNote', replyNote),
		commands.registerCommand('mywiki.replyNote', replyNote),
		commands.registerCommand('mywiki.startDraft', (reply: CommentReply) => {
			const thread = reply.thread;
			thread.contextValue = 'draft';
			const newComment = new NoteComment(reply.text, CommentMode.Preview, { name: 'vscode' }, thread);
			newComment.label = 'pending';
			thread.comments = [...thread.comments, newComment];
		}),
		commands.registerCommand('mywiki.finishDraft', (reply: CommentReply) => {
			const thread = reply.thread;

			if (!thread) {
				return;
			}

			thread.contextValue = undefined;
			thread.collapsibleState = CommentThreadCollapsibleState.Collapsed;
			if (reply.text) {
				const newComment = new NoteComment(reply.text, CommentMode.Preview, { name: 'vscode' }, thread);
				thread.comments = [...thread.comments, newComment].map(comment => {
					comment.label = undefined;
					return comment;
				});
			}
		}),
		commands.registerCommand('mywiki.deleteNoteComment', (comment: NoteComment) => {
			const thread = comment.parent;
			if (!thread) { return; }

			thread.comments = thread.comments.filter(cmt => (cmt as NoteComment).id !== comment.id);

			if (thread.comments.length === 0) {
				thread.dispose();
			}
		}),
		commands.registerCommand('mywiki.deleteNote', (thread: CommentThread) => { thread.dispose(); }),
		commands.registerCommand('mywiki.cancelsaveNote', (comment: NoteComment) => {
			if (!comment.parent) { return; }

			comment.parent.comments = comment.parent.comments.map(cmt => {
				if ((cmt as NoteComment).id === comment.id) {
					cmt.mode = CommentMode.Preview;
				}

				return cmt;
			});
		}),
		commands.registerCommand('mywiki.saveNote', (comment: NoteComment) => {
			if (!comment.parent) { return; }

			comment.parent.comments = comment.parent.comments.map(cmt => {
				if ((cmt as NoteComment).id === comment.id) {
					cmt.mode = CommentMode.Preview;
				}

				return cmt;
			});
		}),
		commands.registerCommand('mywiki.editNote', (comment: NoteComment) => {
			if (!comment.parent) { return; }

			comment.parent.comments = comment.parent.comments.map(cmt => {
				if ((cmt as NoteComment).id === comment.id) {
					cmt.mode = CommentMode.Editing;
				}

				return cmt;
			});
		}),
		commands.registerCommand('mywiki.dispose', commentController.dispose)
	);

}
