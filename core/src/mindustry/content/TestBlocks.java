package mindustry.content;
public class TestBlocks {
    public static void load() {
        blockA = new Block("blockA"){{
            health = 100f;
            buildTime = 60f;
        }};
        blockB = new Block("blockB");
    }
}
