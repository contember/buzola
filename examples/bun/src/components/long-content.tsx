import React from 'react'

/**
 * Enough content to make a page scroll, so back/forward scroll restoration can be tried out.
 * Each page passes its own label so the sections tell the pages apart at any scroll position.
 */
export function LongContent({ label, sections = 30 }: { label: string; sections?: number }) {
	return (
		<div className="long-content">
			{Array.from({ length: sections }, (_, i) => (
				<section key={i}>
					<h3>
						{label}, section {i + 1}
					</h3>
					<p>
						Scroll down, follow a link in the navigation, then come back to check that the page returns to this section.
					</p>
				</section>
			))}
		</div>
	)
}
