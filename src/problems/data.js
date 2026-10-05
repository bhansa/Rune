// Curated LeetCode index — 30 popular problems that most interview prep
// covers. Each entry is the minimum needed to render a row; the full JSON
// (description, examples, hints, code_snippets, solution) is fetched from
// Rust on click and cached to disk.
//
// Data sourced from the public `neenza/leetcode-problems` dataset.

export const PROBLEMS = [
  { id:   1, slug: "two-sum",                                          title: "Two Sum",                                                difficulty: "Easy",   topics: ["Array", "Hash Table"] },
  { id:   3, slug: "longest-substring-without-repeating-characters",   title: "Longest Substring Without Repeating Characters",        difficulty: "Medium", topics: ["Hash Table", "String", "Sliding Window"] },
  { id:  11, slug: "container-with-most-water",                        title: "Container With Most Water",                              difficulty: "Medium", topics: ["Array", "Two Pointers"] },
  { id:  15, slug: "3sum",                                             title: "3Sum",                                                   difficulty: "Medium", topics: ["Array", "Two Pointers", "Sorting"] },
  { id:  19, slug: "remove-nth-node-from-end-of-list",                 title: "Remove Nth Node From End of List",                       difficulty: "Medium", topics: ["Linked List", "Two Pointers"] },
  { id:  20, slug: "valid-parentheses",                                title: "Valid Parentheses",                                      difficulty: "Easy",   topics: ["String", "Stack"] },
  { id:  21, slug: "merge-two-sorted-lists",                           title: "Merge Two Sorted Lists",                                 difficulty: "Easy",   topics: ["Linked List", "Recursion"] },
  { id:  33, slug: "search-in-rotated-sorted-array",                   title: "Search in Rotated Sorted Array",                         difficulty: "Medium", topics: ["Array", "Binary Search"] },
  { id:  42, slug: "trapping-rain-water",                              title: "Trapping Rain Water",                                    difficulty: "Hard",   topics: ["Array", "Two Pointers", "Dynamic Programming", "Stack"] },
  { id:  49, slug: "group-anagrams",                                   title: "Group Anagrams",                                         difficulty: "Medium", topics: ["Hash Table", "String", "Sorting"] },
  { id:  53, slug: "maximum-subarray",                                 title: "Maximum Subarray",                                       difficulty: "Medium", topics: ["Array", "Divide and Conquer", "Dynamic Programming"] },
  { id:  56, slug: "merge-intervals",                                  title: "Merge Intervals",                                        difficulty: "Medium", topics: ["Array", "Sorting"] },
  { id:  70, slug: "climbing-stairs",                                  title: "Climbing Stairs",                                        difficulty: "Easy",   topics: ["Math", "Dynamic Programming", "Memoization"] },
  { id:  76, slug: "minimum-window-substring",                         title: "Minimum Window Substring",                               difficulty: "Hard",   topics: ["Hash Table", "String", "Sliding Window"] },
  { id: 102, slug: "binary-tree-level-order-traversal",                title: "Binary Tree Level Order Traversal",                      difficulty: "Medium", topics: ["Tree", "Breadth-First Search", "Binary Tree"] },
  { id: 104, slug: "maximum-depth-of-binary-tree",                     title: "Maximum Depth of Binary Tree",                           difficulty: "Easy",   topics: ["Tree", "Depth-First Search", "Binary Tree"] },
  { id: 121, slug: "best-time-to-buy-and-sell-stock",                  title: "Best Time to Buy and Sell Stock",                        difficulty: "Easy",   topics: ["Array", "Dynamic Programming"] },
  { id: 125, slug: "valid-palindrome",                                 title: "Valid Palindrome",                                       difficulty: "Easy",   topics: ["Two Pointers", "String"] },
  { id: 128, slug: "longest-consecutive-sequence",                     title: "Longest Consecutive Sequence",                           difficulty: "Medium", topics: ["Array", "Hash Table", "Union Find"] },
  { id: 141, slug: "linked-list-cycle",                                title: "Linked List Cycle",                                      difficulty: "Easy",   topics: ["Hash Table", "Linked List", "Two Pointers"] },
  { id: 146, slug: "lru-cache",                                        title: "LRU Cache",                                              difficulty: "Medium", topics: ["Hash Table", "Linked List", "Design", "Doubly-Linked List"] },
  { id: 198, slug: "house-robber",                                     title: "House Robber",                                           difficulty: "Medium", topics: ["Array", "Dynamic Programming"] },
  { id: 200, slug: "number-of-islands",                                title: "Number of Islands",                                      difficulty: "Medium", topics: ["Array", "Depth-First Search", "Breadth-First Search", "Matrix"] },
  { id: 206, slug: "reverse-linked-list",                              title: "Reverse Linked List",                                    difficulty: "Easy",   topics: ["Linked List", "Recursion"] },
  { id: 207, slug: "course-schedule",                                  title: "Course Schedule",                                        difficulty: "Medium", topics: ["Graph", "Topological Sort", "Depth-First Search", "Breadth-First Search"] },
  { id: 217, slug: "contains-duplicate",                               title: "Contains Duplicate",                                     difficulty: "Easy",   topics: ["Array", "Hash Table", "Sorting"] },
  { id: 226, slug: "invert-binary-tree",                               title: "Invert Binary Tree",                                     difficulty: "Easy",   topics: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"] },
  { id: 238, slug: "product-of-array-except-self",                     title: "Product of Array Except Self",                           difficulty: "Medium", topics: ["Array", "Prefix Sum"] },
  { id: 322, slug: "coin-change",                                      title: "Coin Change",                                            difficulty: "Medium", topics: ["Array", "Dynamic Programming", "Breadth-First Search"] },
  { id: 347, slug: "top-k-frequent-elements",                          title: "Top K Frequent Elements",                                difficulty: "Medium", topics: ["Array", "Hash Table", "Divide and Conquer", "Sorting", "Heap"] },
];

export const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"];
