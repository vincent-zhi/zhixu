class Calculator:
    """一个简单的计算器类"""

    def add(self, a, b):
        """加法运算"""
        return a + b

    def subtract(self, a, b):
        """减法运算"""
        return a - b


if __name__ == "__main__":
    calc = Calculator()
    print(f"10 + 5 = {calc.add(10, 5)}")
    print(f"10 - 5 = {calc.subtract(10, 5)}")