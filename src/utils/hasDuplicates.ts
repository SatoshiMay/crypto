export function hasDuplicates(a: number[]|string[]) {
  const counts: any = [];
  let i = a.length;
  while (i--)
    if (counts[a[i]] === undefined)
      counts[a[i]] = 1;
    else
      return true;
  return false;
}
