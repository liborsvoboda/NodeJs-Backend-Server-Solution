module.exports = (sequelize, type) => {
    return sequelize.define('notificationsDictionary', {
    id: {
        type: type.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    systemName: {
        type: type.STRING(150),
        allowNull: false
    },
    cs: {
        type: type.STRING(1024),
        allowNull: true
    },
    sk: {
        type: type.STRING(1024),
        allowNull: true
    },
    en: {
        type: type.STRING(1024),
        allowNull: true
    },
    using: {
        type: type.STRING(10),
        allowNull: false
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'IX_systemName',
        fields: ['systemName','using']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
