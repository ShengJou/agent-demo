import os
import sys
import subprocess


def _check_and_install_dependencies():
    """
    检查并安装脚本所需的依赖。
    """
    try:
        print("正在检查所需依赖 `openxlab`...")
        __import__('openxlab')
        print("✔ `openxlab` 已安装。")
    except ImportError:
        print("`openxlab` 未安装，正在为您自动安装...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-U", "openxlab"])
            print("✔ `openxlab` 安装成功！")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"❌ 自动安装 `openxlab` 失败: {e}")
            print("请手动运行 `pip install -U openxlab` 后再重新运行此脚本。")
            sys.exit(1)


# 在导入 openxlab 之前，确保它已经被安装
_check_and_install_dependencies()

import openxlab


# --- 配置 ---
# 请将您的 Access Key 和 Secret Key 填入此处
ACCESS_KEY = "mxjlkmbroqwgbyvm1pvk"
SECRET_KEY = "9zza4rl2eo0wva8bl7zl6wvk85bqxopdlr7dkmqx"

# 要下载的数据集
DATASET_REPO = 'OpenDataLab/CCPD'

# 本地保存路径 (脚本所在目录下的 datasets/CCPD 文件夹)
TARGET_PATH = os.path.join(os.path.dirname(__file__), 'datasets', 'CCPD')

# --- 脚本主程序 ---
def main():
    """
    主函数，用于登录、下载并验证数据集。
    """
    print("--- 开始下载数据集脚本 ---")

    # 1. 登录 OpenXLab
    try:
        print(f"正在登录 OpenXLab...")
        openxlab.login(ak=ACCESS_KEY, sk=SECRET_KEY)
        print("✔ 登录成功！")
    except Exception as e:
        print(f"❌ 登录失败: {e}")
        return

    # 2. 查看数据集信息
    try:
        print(f"\n正在获取数据集 '{DATASET_REPO}' 的信息...")
        from openxlab.dataset import info
        info(dataset_repo=DATASET_REPO)
        print("✔ 数据集信息获取成功。")
    except Exception as e:
        print(f"❌ 获取数据集信息失败: {e}")
        # 即使信息获取失败，我们仍然可以尝试下载
        pass

    # 3. 准备本地下载目录
    print(f"\n准备本地下载目录: {TARGET_PATH}")
    os.makedirs(TARGET_PATH, exist_ok=True)
    print("✔ 目录已准备就绪。")

    # 4. 下载数据集
    try:
        print(f"\n开始下载数据集到 '{TARGET_PATH}'...")
        print("这可能需要一些时间，请耐心等待...")
        from openxlab.dataset import get
        get(dataset_repo=DATASET_REPO, target_path=TARGET_PATH)
        print("\n✔✔✔ 数据集下载完成！ ✔✔✔")
    except Exception as e:
        print(f"❌ 下载过程中发生错误: {e}")

    print("\n--- 脚本执行完毕 ---")


if __name__ == '__main__':
    main() 