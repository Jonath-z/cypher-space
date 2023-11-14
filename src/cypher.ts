class VigenereCipher {
  private key: string;
  private abc: string;

  constructor(key: string, abc: string) {
    this.key = key;
    this.abc = abc;
  }

  private getKeyLettersPosition(): number[] {
    return this.key.split("").reduce((set: number[], val) => {
      if (this.abc.indexOf(val) !== -1) {
        set.push(this.abc.indexOf(val) + 1);
      }

      return set;
    }, []);
  }

  public encode(str: string): string {
    const cryptoKey = this.getKeyLettersPosition();

    const encodedAbc = str.split("").map((letter, index) => {
      if (this.abc.indexOf(letter) === -1) return letter;

      if (cryptoKey[index]) {
        const jump = this.abc.indexOf(letter) - 1 + cryptoKey[index];

        if (jump > this.abc.length - 1) {
          return this.abc[jump % this.abc.length];
        }

        return this.abc[jump];
      } else {
        const jump =
          this.abc.indexOf(letter) - 1 + cryptoKey[index % cryptoKey.length];

        if (jump > this.abc.length - 1) {
          return this.abc[jump % this.abc.length];
        }

        return this.abc[jump];
      }
    });

    return encodedAbc.join("");
  }

  public decode(str: string): string {
    const cryptoKey = this.getKeyLettersPosition();

    const decoded = str.split("").map((letter, index) => {
      if (this.abc.indexOf(letter) === -1) return letter;
      if (cryptoKey[index]) {
        let jump = this.abc.indexOf(letter) - cryptoKey[index] + 1;

        if (jump < 0) jump += this.abc.length;

        return this.abc[jump];
      } else {
        let jump =
          this.abc.indexOf(letter) - cryptoKey[index % cryptoKey.length] + 1;

        if (jump < 0) jump += this.abc.length;

        return this.abc[jump];
      }
    });

    return decoded.join("");
  }
}

export default VigenereCipher;
