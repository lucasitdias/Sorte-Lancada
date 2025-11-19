export const censorName = (username: string): string => {
  const usernameArray = username.trim().split(' ');
  let censoredArray: string[] = [];

  usernameArray?.forEach((word, index) => {
    if ([usernameArray.length - 1, 0].includes(index)) {
      censoredArray.push(word);
    } else {
      censoredArray.push(
        word
          .split('')
          .map((char, index) => {
            if (index === 0) return char;
            return '*';
          })
          .join(''),
      );
    }
  });
  return censoredArray.join(' ');
};
