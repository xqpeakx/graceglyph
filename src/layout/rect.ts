export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export class Rect {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  static empty(): Rect {
    return new Rect(0, 0, 0, 0);
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  contains(px: number, py: number): boolean {
    return px >= this.x && px < this.right && py >= this.y && py < this.bottom;
  }

  intersect(other: Rect): Rect {
    const x = Math.max(this.x, other.x);
    const y = Math.max(this.y, other.y);
    const right = Math.min(this.right, other.right);
    const bottom = Math.min(this.bottom, other.bottom);
    return new Rect(
      x,
      y,
      Math.max(0, right - x),
      Math.max(0, bottom - y),
    );
  }

  translate(dx: number, dy: number): Rect {
    return new Rect(this.x + dx, this.y + dy, this.width, this.height);
  }

  inset(top: number, right = top, bottom = top, left = right): Rect {
    return new Rect(
      this.x + left,
      this.y + top,
      Math.max(0, this.width - left - right),
      Math.max(0, this.height - top - bottom),
    );
  }

  equals(other: Rect): boolean {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height
    );
  }
}
